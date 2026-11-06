import prisma from "@/lib/prisma";
import { computeRagScore } from "@/lib/rag-engine";
import { generateAlerts } from "@/lib/alert-engine";

export async function syncCandidate(
  candidateId: string,
  actorId: string | null,
  now: Date = new Date(),
  opts: { skipTransition?: boolean } = {}
) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return null;

  const rag = computeRagScore(candidate, now);
  const ragChanged = rag.color !== candidate.ragColor;
  const activated = rag.color !== "GREY";

  if (ragChanged && !opts.skipTransition) {
    await prisma.ragTransition.create({
      data: {
        candidateId,
        fromColor: candidate.ragColor,
        toColor: rag.color,
        fromScore: candidate.ragScore,
        toScore: rag.total,
        reason: "Recomputed",
      },
    });
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      ragScore: rag.total,
      ragColor: rag.color,
      ragActivated: activated ? true : candidate.ragActivated,
      ragActivationDate:
        activated && !candidate.ragActivated ? now : candidate.ragActivationDate,
    },
  });

  const lastCheck = await prisma.dynamicCheck.findFirst({
    where: { candidateId, checkType: "RISK_CHECK", completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });

  const defs = generateAlerts(
    { ...candidate, candidateId: candidate.id, lastRiskCheckAt: lastCheck?.completedAt },
    now
  );
  const generatedTypes = new Set<string>(defs.map((d) => d.type));
  const open = await prisma.alert.findMany({
    where: { candidateId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { createdAt: "asc" },
  });

  let alertsCreated = 0;
  let alertsUpdated = 0;
  let alertsClosed = 0;

  for (const def of defs) {
    const same = open.filter((a) => a.type === def.type);
    if (same.length > 0) {
      await prisma.alert.update({
        where: { id: same[0].id },
        data: {
          dueDate: def.dueDate,
          priority: def.priority,
          title: def.title,
          description: def.description,
        },
      });
      alertsUpdated++;
      for (const dup of same.slice(1)) {
        await prisma.alert.update({
          where: { id: dup.id },
          data: { status: "DISMISSED" },
        });
        alertsClosed++;
      }
    } else {
      const assignedToId = candidate.recruiterId ?? actorId;
      if (!assignedToId) continue;
      await prisma.alert.create({
        data: { candidateId, ...def, assignedToId },
      });
      alertsCreated++;
    }
  }

  for (const a of open) {
    if (!generatedTypes.has(a.type)) {
      await prisma.alert.update({
        where: { id: a.id },
        data: { status: "COMPLETED", completedAt: now },
      });
      alertsClosed++;
    }
  }

  return {
    ragChanged,
    fromColor: candidate.ragColor,
    toColor: rag.color,
    fromScore: candidate.ragScore,
    toScore: rag.total,
    alertsCreated,
    alertsUpdated,
    alertsClosed,
  };
}
