import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAIInsights } from "@/lib/ai-insights";
import { getAuthSession, unauthorizedResponse } from "@/lib/api-auth";
import { ACTIVE_STATUSES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const candidates = await prisma.candidate.findMany({
      where: { currentStatus: { in: ACTIVE_STATUSES } },
      include: {
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { sentiment: true, type: true, createdAt: true },
        },
      },
    });

    const insights = await generateAIInsights(candidates);

    return NextResponse.json({ insights, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/ai/insights error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
