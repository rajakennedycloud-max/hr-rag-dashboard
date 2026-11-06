import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeRagScore, type CandidateRagInput } from "@/lib/rag-engine";
import { updateCandidateSchema, formatZodError } from "@/lib/validations";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";
import { syncCandidate } from "@/lib/candidate-sync";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        scoreHistory: { orderBy: { createdAt: "desc" }, take: 50 },
        ragTransitions: { orderBy: { createdAt: "desc" }, take: 20 },
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { name: true, email: true } } },
        },
        alerts: { orderBy: { createdAt: "desc" }, take: 30 },
        weeklyUpdates: { orderBy: { weekNumber: "desc" }, take: 20 },
        dynamicChecks: { orderBy: { scheduledAt: "desc" }, take: 20 },
        remarkHistory: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("GET /api/candidates/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch candidate" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const body = await req.json();
    const parsed = updateCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Build the old RAG input for comparison
    const oldRagInput: CandidateRagInput = {
      offerExtendedDate: candidate.offerExtendedDate,
      expectedDOJ: candidate.expectedDOJ,
      resignationReceived: candidate.resignationReceived,
      resignationReceivedAt: candidate.resignationReceivedAt,
      preJoiningConnect1: candidate.preJoiningConnect1,
      preJoiningConnect1Date: candidate.preJoiningConnect1Date,
      preJoiningConnect2: candidate.preJoiningConnect2,
      preJoiningConnect2Date: candidate.preJoiningConnect2Date,
      kycCompleted: candidate.kycCompleted,
      kycCompletedAt: candidate.kycCompletedAt,
      lwdConfirmed: candidate.lwdConfirmed,
      lwdConfirmedAt: candidate.lwdConfirmedAt,
      counterOfferReceived: candidate.counterOfferReceived,
      activeOnJobPortal: candidate.activeOnJobPortal,
      currentStatus: candidate.currentStatus,
    };

    // Prepare update data
    const updateData: any = {};
    const auditChanges: string[] = [];

    // Map body fields to update data
    const fieldMappings: Record<string, string> = {
      preJoiningConnect1: "preJoiningConnect1",
      preJoiningConnect2: "preJoiningConnect2",
      resignationReceived: "resignationReceived",
      kycCompleted: "kycCompleted",
      lwdConfirmed: "lwdConfirmed",
      counterOfferReceived: "counterOfferReceived",
      activeOnJobPortal: "activeOnJobPortal",
      candidateDemands: "candidateDemands",
      recruiterRemarks: "recruiterRemarks",
      currentStatus: "currentStatus",
      resignationProofUrl: "resignationProofUrl",
      resignationProofFile: "resignationProofFile",
      kycDocumentsFile: "kycDocumentsFile",
      resumeFile: "resumeFile",
      recruiterId: "recruiterId",
    };

    for (const [bodyKey, dbKey] of Object.entries(fieldMappings)) {
      if (body[bodyKey] !== undefined) {
        updateData[dbKey] = body[bodyKey];
        auditChanges.push(`${bodyKey}: ${(candidate as any)[dbKey]} → ${body[bodyKey]}`);
        
        // Track remark changes specifically
        if (bodyKey === 'recruiterRemarks' || bodyKey === 'candidateDemands') {
          const previousValue = (candidate as any)[dbKey];
          const newValue = body[bodyKey];
          
          // Only track if the value actually changed
          if (previousValue !== newValue) {
            await prisma.remarkHistory.create({
              data: {
                candidateId: params.id,
                userId: body.userId,
                remarkType: bodyKey === 'recruiterRemarks' ? 'RECRUITER_REMARKS' : 'CANDIDATE_DEMANDS',
                previousValue: previousValue || null,
                newValue: newValue,
                reason: body.remarkReason || null,
              },
            });
          }
        }
      }
    }

    // Handle date fields
    if (body.resignationReceived && !candidate.resignationReceivedAt) {
      updateData.resignationReceivedAt = new Date();
    }
    if (body.preJoiningConnect1 === "COMPLETED" && !candidate.preJoiningConnect1Date) {
      updateData.preJoiningConnect1Date = new Date();
    }
    if (body.preJoiningConnect2 === "COMPLETED" && !candidate.preJoiningConnect2Date) {
      updateData.preJoiningConnect2Date = new Date();
    }
    if (body.kycCompleted && !candidate.kycCompletedAt) {
      updateData.kycCompletedAt = new Date();
    }
    if (body.lwdConfirmed && !candidate.lwdConfirmedAt) {
      updateData.lwdConfirmedAt = new Date();
    }

    // Compute new RAG score
    const newRagInput: CandidateRagInput = {
      ...oldRagInput,
      ...updateData,
      currentStatus: updateData.currentStatus || candidate.currentStatus,
    };

    const oldScore = computeRagScore(oldRagInput);
    const newScore = computeRagScore(newRagInput);

    updateData.ragScore = newScore.total;
    updateData.ragColor = newScore.color;

    if (newScore.color !== "GREY" && !candidate.ragActivated) {
      updateData.ragActivated = true;
      updateData.ragActivationDate = new Date();
    }

    // Update candidate
    const updated = await prisma.candidate.update({
      where: { id: params.id },
      data: updateData,
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
      },
    });

    // Record score change if score changed
    if (oldScore.total !== newScore.total) {
      await prisma.scoreHistory.create({
        data: {
          candidateId: params.id,
          parameter: auditChanges[0]?.split(":")[0] || "MANUAL_UPDATE",
          oldScore: oldScore.total,
          newScore: newScore.total,
          impact: newScore.total - oldScore.total,
          reason: auditChanges.join("; "),
        },
      });
    }

    // Record RAG transition if color changed
    if (oldScore.color !== newScore.color) {
      await prisma.ragTransition.create({
        data: {
          candidateId: params.id,
          fromColor: oldScore.color,
          toColor: newScore.color,
          fromScore: oldScore.total,
          toScore: newScore.total,
          reason: auditChanges.join("; "),
        },
      });
    }

    // Reassign open alerts when the recruiter changes
    if (updateData.recruiterId && updateData.recruiterId !== candidate.recruiterId) {
      await prisma.alert.updateMany({
        where: { candidateId: params.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
        data: { assignedToId: updateData.recruiterId },
      });
    }

    // Sync alerts (RAG transition already recorded above)
    await syncCandidate(params.id, body.userId ?? session.user.id, new Date(), {
      skipTransition: true,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: body.userId,
        entityType: "CANDIDATE",
        entityId: params.id,
        action: "UPDATE",
        oldValue: JSON.stringify(
          Object.fromEntries(
            Object.keys(updateData).map((k) => [k, (candidate as any)[k]])
          )
        ),
        newValue: JSON.stringify(updateData),
        description: `Updated candidate ${candidate.candidateName}: ${auditChanges.join(", ")}`,
      },
    });

    return NextResponse.json({
      candidate: updated,
      scoreChange: {
        oldScore: oldScore.total,
        newScore: newScore.total,
        oldColor: oldScore.color,
        newColor: newScore.color,
        breakdown: newScore,
      },
    });
  } catch (error) {
    console.error("PATCH /api/candidates/[id] error:", error);
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
  }
}
