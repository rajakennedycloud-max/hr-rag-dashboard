import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncCandidate } from "@/lib/candidate-sync";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { getAuthSession, unauthorizedResponse } from "@/lib/api-auth";

async function runCompute(actorId: string | null) {
  await prisma.alert.updateMany({
    where: { type: { in: ["JOB_PORTAL_CHECK", "COUNTER_CHECK"] }, status: { in: ["OPEN", "IN_PROGRESS"] } },
    data: { status: "DISMISSED" },
  });

  const candidates = await prisma.candidate.findMany({
    where: { currentStatus: { in: ACTIVE_STATUSES } },
  });

  const results = [];
  const now = new Date();

  for (const candidate of candidates) {
    const r = await syncCandidate(candidate.id, actorId, now);
    if (!r) continue;
    if (Math.abs(r.toScore - r.fromScore) > 0.01 || r.toColor !== r.fromColor) {
      if (Math.abs(r.toScore - r.fromScore) > 0.01) {
        await prisma.scoreHistory.create({
          data: {
            candidateId: candidate.id,
            parameter: "AUTO_RECOMPUTE",
            oldScore: r.fromScore,
            newScore: r.toScore,
            impact: r.toScore - r.fromScore,
            reason: "Automated periodic score recomputation",
          },
        });
      }
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        oldScore: r.fromScore,
        newScore: r.toScore,
        oldColor: r.fromColor,
        newColor: r.toColor,
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: "SCORE",
      entityId: "BATCH",
      action: "SCORE_CHANGE",
      description: `Batch RAG recomputation: ${results.length} of ${candidates.length} candidates updated`,
      newValue: JSON.stringify({ updatedCount: results.length, totalCount: candidates.length }),
    },
  });

  return NextResponse.json({
    message: `Recomputed ${candidates.length} candidates, ${results.length} updated`,
    changes: results,
  });
}

// Batch recompute RAG scores for all active candidates
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    return await runCompute(session.user.id);
  } catch (error) {
    console.error("POST /api/rag/compute error:", error);
    return NextResponse.json({ error: "Failed to recompute RAG scores" }, { status: 500 });
  }
}

// External scheduler entrypoint, guarded by a shared secret
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return await runCompute(null);
  } catch (error) {
    console.error("GET /api/rag/compute error:", error);
    return NextResponse.json({ error: "Failed to recompute RAG scores" }, { status: 500 });
  }
}
