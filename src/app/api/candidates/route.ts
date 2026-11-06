import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeRagScore } from "@/lib/rag-engine";
import { generateAlerts } from "@/lib/alert-engine";
import { candidateQuerySchema, createCandidateSchema, formatZodError } from "@/lib/validations";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const query = candidateQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) {
      return NextResponse.json(formatZodError(query.error), { status: 400 });
    }

    const { status, ragColor, sector, recruiterId, search, page, limit } = query.data;

    const where: any = {};
    if (status) where.currentStatus = status;
    if (ragColor) where.ragColor = ragColor;
    if (sector) where.sector = sector;
    if (recruiterId) where.recruiterId = recruiterId;
    if (search) {
      where.OR = [
        { candidateName: { contains: search } },
        { email: { contains: search } },
        { reqNumber: { contains: search } },
        { candidateExternalId: { contains: search } },
      ];
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: {
          recruiter: { select: { id: true, name: true, email: true } },
          _count: { select: { alerts: true, interactions: true } },
        },
        orderBy: [{ ragScore: "asc" }, { expectedDOJ: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.candidate.count({ where }),
    ]);

    return NextResponse.json({
      candidates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/candidates error:", error);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const body = await req.json();
    const parsed = createCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const data = parsed.data;
    const candidate = await prisma.candidate.create({
      data: {
        reqNumber: data.reqNumber,
        candidateExternalId: data.candidateExternalId,
        candidateName: data.candidateName,
        mobileNumber: data.mobileNumber,
        email: data.email,
        currentStatus: data.currentStatus || "OFFERED",
        expectedDOJ: new Date(data.expectedDOJ),
        joiningMonth:
          data.joiningMonth ??
          new Date(data.expectedDOJ).toLocaleDateString("en-US", {
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          }),
        offerExtendedDate: new Date(data.offerExtendedDate),
        offerLocation: data.offerLocation,
        employeeClassification: data.employeeClassification,
        sector: data.sector,
        actualCustomer: data.actualCustomer,
        offeredSkill: data.offeredSkill,
        offeredLevel: data.offeredLevel,
        hiringManagerEmail: data.hiringManagerEmail,
        recruiterId: data.recruiterId,
        ragScore: 50,
        ragColor: "GREY",
      },
    });

    // Compute initial RAG score
    const ragInput = {
      offerExtendedDate: candidate.offerExtendedDate,
      expectedDOJ: candidate.expectedDOJ,
      resignationReceived: false,
      preJoiningConnect1: null,
      preJoiningConnect2: null,
      kycCompleted: false,
      lwdConfirmed: false,
      counterOfferReceived: false,
      activeOnJobPortal: false,
      currentStatus: "OFFERED",
    };

    const score = computeRagScore(ragInput);

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { ragScore: score.total, ragColor: score.color },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: "CANDIDATE",
        entityId: candidate.id,
        action: "CREATE",
        newValue: JSON.stringify({ name: candidate.candidateName, reqNumber: candidate.reqNumber }),
        description: `New candidate ${candidate.candidateName} added with Req ${candidate.reqNumber}`,
      },
    });

    // Generate initial alerts
    const alertDefs = generateAlerts({
      candidateId: candidate.id,
      candidateName: candidate.candidateName,
      offerExtendedDate: candidate.offerExtendedDate,
      expectedDOJ: candidate.expectedDOJ,
      resignationReceived: false,
      preJoiningConnect1: null,
      preJoiningConnect2: null,
      kycCompleted: false,
      lwdConfirmed: false,
      currentStatus: "OFFERED",
    });

    if (alertDefs.length > 0 && body.recruiterId) {
      await prisma.alert.createMany({
        data: alertDefs.map((a) => ({
          candidateId: candidate.id,
          assignedToId: body.recruiterId,
          type: a.type,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          priority: a.priority,
        })),
      });
    }

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("POST /api/candidates error:", error);
    return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
  }
}
