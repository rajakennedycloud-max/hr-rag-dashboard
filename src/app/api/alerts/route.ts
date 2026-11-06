import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { alertQuerySchema, updateAlertSchema, formatZodError } from "@/lib/validations";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const query = alertQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) {
      return NextResponse.json(formatZodError(query.error), { status: 400 });
    }

    const { assignedToId, status, candidateId } = query.data;

    const where: any = {};
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) where.status = status;
    if (candidateId) where.candidateId = candidateId;

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        candidate: {
          select: {
            candidateName: true,
            ragColor: true,
            ragScore: true,
            expectedDOJ: true,
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        { priority: "asc" },
        { dueDate: "asc" },
      ],
    });

    return NextResponse.json(alerts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const body = await req.json();
    const parsed = updateAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const { alertId, status, userId } = parsed.data;

    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : undefined,
      },
    });

    // Completing a periodic risk check schedules the next interval
    if (status === "COMPLETED" && alert.type === "RISK_CHECK") {
      const checkCount = await prisma.dynamicCheck.count({
        where: { candidateId: alert.candidateId, checkType: "RISK_CHECK" },
      });
      await prisma.dynamicCheck.create({
        data: {
          candidateId: alert.candidateId,
          checkType: "RISK_CHECK",
          checkNumber: checkCount + 1,
          scheduledAt: alert.dueDate,
          completedAt: new Date(),
          result: false,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "ALERT",
        entityId: alertId,
        action: "UPDATE",
        newValue: JSON.stringify({ status }),
        description: `Alert "${alert.title}" marked as ${status}`,
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
