import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { syncCandidate } from "@/lib/candidate-sync";
import { ACTIVE_STATUSES, NOT_IN_SNAPSHOT } from "@/lib/constants";
import {
  mapRow,
  DELTA_FIELDS,
  recruiterEmailFromName,
  type CandidateRow,
} from "@/lib/excel-mapping";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const TEST_RECRUITER_PASSWORD = "hr@2024";

// Resolves a workbook "Recruiter" display name to a User, auto-creating a
// TA_SPECIALIST account with an @hrtest.com address when needed.
async function resolveRecruiter(name: string | null, cache: Map<string, string>) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const email = recruiterEmailFromName(name);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        password: await bcrypt.hash(TEST_RECRUITER_PASSWORD, 10),
        role: "TA_SPECIALIST",
      },
    });
  }
  cache.set(key, user.id);
  return user.id;
}

function valueChanged(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const ta = a ? new Date(a as Date).getTime() : null;
    const tb = b ? new Date(b as Date).getTime() : null;
    return ta !== tb;
  }
  return (a ?? null) !== (b ?? null);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const data = await req.formData();
    const file = data.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 413 });
    }
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      return NextResponse.json(
        { error: "Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, unknown>[];

    if (jsonData.length === 0) {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });
    }

    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        importedById: session.user.id,
        totalRows: jsonData.length,
        status: "COMPLETED",
      },
    });

    const errors: string[] = [];
    const recruiterCache = new Map<string, string>();
    let created = 0, updated = 0, unchanged = 0, skipped = 0;

    const actorId = session.user.id;

    for (let i = 0; i < jsonData.length; i++) {
      const rowNum = i + 2;
      const parsed = mapRow(jsonData[i]);
      if (parsed.error) {
        errors.push(`Row ${rowNum}: ${parsed.error}`);
        skipped++;
        continue;
      }
      const row = parsed.data as CandidateRow;
      const { recruiterName, ...fields } = row;

      try {
        const recruiterId = await resolveRecruiter(recruiterName, recruiterCache);
        const existing = await prisma.candidate.findUnique({
          where: { candidateExternalId: row.candidateExternalId },
        });

        if (!existing) {
          const candidate = await prisma.candidate.create({
            data: {
              ...fields,
              recruiterId: recruiterId ?? actorId,
              lastImportBatchId: batch.id,
            },
          });

          await syncCandidate(candidate.id, actorId);

          await prisma.auditLog.create({
            data: {
              userId: actorId,
              entityType: "CANDIDATE",
              entityId: candidate.id,
              action: "CREATE",
              description: `Imported from "${file.name}"`,
            },
          });

          created++;
        } else {
          // Delta detection: compare snapshot fields against the stored record
          const diffs: { field: string; oldValue: string; newValue: string }[] = [];
          for (const f of DELTA_FIELDS) {
            const oldV = (existing as any)[f];
            const newV = (fields as any)[f];
            if (valueChanged(oldV, newV)) {
              diffs.push({
                field: f,
                oldValue: oldV instanceof Date ? oldV.toISOString().slice(0, 10) : String(oldV ?? ""),
                newValue: newV instanceof Date ? newV.toISOString().slice(0, 10) : String(newV ?? ""),
              });
            }
          }
          const recruiterChanged =
            recruiterId !== null && recruiterId !== existing.recruiterId;

          if (diffs.length === 0 && !recruiterChanged) {
            await prisma.candidate.update({
              where: { id: existing.id },
              data: { lastImportBatchId: batch.id },
            });
            unchanged++;
          } else {
            // Preserve TA-entered workflow fields (connects, KYC, LWD, etc.) —
            // only SR-system fields are overwritten by the snapshot.
            const updatedCandidate = await prisma.candidate.update({
              where: { id: existing.id },
              data: {
                ...fields,
                ...(recruiterChanged ? { recruiterId } : {}),
                lastImportBatchId: batch.id,
              },
            });

            await syncCandidate(updatedCandidate.id, actorId);

            await prisma.auditLog.create({
              data: {
                userId: actorId,
                entityType: "CANDIDATE",
                entityId: existing.id,
                action: "UPDATE",
                oldValue: JSON.stringify(Object.fromEntries(diffs.map((d) => [d.field, d.oldValue]))),
                newValue: JSON.stringify(Object.fromEntries(diffs.map((d) => [d.field, d.newValue]))),
                description: `Updated from "${file.name}": ${diffs
                  .map((d) => `${d.field} ${d.oldValue || "∅"}→${d.newValue || "∅"}`)
                  .join("; ")}${recruiterChanged ? "; recruiter reassigned" : ""}`,
              },
            });

            updated++;
          }
        }
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        skipped++;
      }
    }

    // Snapshot reconciliation: active candidates absent from this file
    const missingCandidates = await prisma.candidate.findMany({
      where: {
        currentStatus: { in: ACTIVE_STATUSES },
        lastImportBatchId: { not: batch.id },
        NOT: { lastImportBatchId: null },
      },
      select: { id: true, candidateName: true },
    });
    if (missingCandidates.length > 0) {
      await prisma.candidate.updateMany({
        where: { id: { in: missingCandidates.map((c) => c.id) } },
        data: { currentStatus: NOT_IN_SNAPSHOT },
      });
      await prisma.auditLog.createMany({
        data: missingCandidates.map((c) => ({
          userId: actorId,
          entityType: "CANDIDATE",
          entityId: c.id,
          action: "UPDATE",
          description: `Not present in "${file.name}" — marked ${NOT_IN_SNAPSHOT}`,
        })),
      });
    }
    const missing = missingCandidates.length;

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        created,
        updated,
        unchanged,
        missing,
        skipped,
        errorCount: errors.length,
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
        status: errors.length > 0 ? "PARTIAL" : "COMPLETED",
      },
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      message: `Import complete: ${created} added, ${updated} updated, ${unchanged} unchanged, ${skipped} skipped, ${missing} missing`,
      created,
      updated,
      unchanged,
      skipped,
      missing,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json({ error: "Failed to import Excel file" }, { status: 500 });
  }
}
