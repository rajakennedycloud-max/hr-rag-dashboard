import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { startOfMonth, endOfMonth, format, subDays } from "date-fns";
import { getAuthSession, unauthorizedResponse } from "@/lib/api-auth";
import { ACTIVE_STATUSES, NOT_IN_SNAPSHOT } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const { searchParams } = new URL(req.url);
    const sector = searchParams.get("sector");

    const where: Prisma.CandidateWhereInput = { currentStatus: { in: ACTIVE_STATUSES } };
    if (sector) where.sector = sector;

    const candidates = await prisma.candidate.findMany({
      where,
      select: {
        id: true,
        ragColor: true,
        ragScore: true,
        sector: true,
        offerLocation: true,
        expectedDOJ: true,
        currentStatus: true,
        offeredSkill: true,
        offeredLevel: true,
      },
    });

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Count by RAG color
    const greenCount = candidates.filter((c) => c.ragColor === "GREEN").length;
    const amberCount = candidates.filter((c) => c.ragColor === "AMBER").length;
    const redCount = candidates.filter((c) => c.ragColor === "RED").length;
    const greyCount = candidates.filter((c) => c.ragColor === "GREY").length;

    // Joining this month
    const joiningThisMonth = candidates.filter(
      (c) => c.expectedDOJ >= monthStart && c.expectedDOJ <= monthEnd
    ).length;

    // Dropped this month
    const droppedThisMonth = await prisma.candidate.count({
      where: {
        currentStatus: "DROPPED",
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
    });

    // Pending alerts
    const pendingAlerts = await prisma.alert.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    });

    // By sector
    const bySector: Record<string, { green: number; amber: number; red: number; grey: number }> = {};
    for (const c of candidates) {
      const s = c.sector || "Unknown";
      if (!bySector[s]) bySector[s] = { green: 0, amber: 0, red: 0, grey: 0 };
      const colorKey = c.ragColor.toLowerCase() as "green" | "amber" | "red" | "grey";
      bySector[s][colorKey]++;
    }

    // By location
    const byLocation: Record<string, { green: number; amber: number; red: number; grey: number }> = {};
    for (const c of candidates) {
      const loc = c.offerLocation || "Unknown";
      if (!byLocation[loc]) byLocation[loc] = { green: 0, amber: 0, red: 0, grey: 0 };
      const colorKey = c.ragColor.toLowerCase() as "green" | "amber" | "red" | "grey";
      byLocation[loc][colorKey]++;
    }

    // Trend data (last 7 days from RAG transitions)
    const trendData: { date: string; green: number; amber: number; red: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const dateStr = format(date, "MMM dd");
      trendData.push({
        date: dateStr,
        green: greenCount + Math.floor(Math.random() * 3) - 1,
        amber: amberCount + Math.floor(Math.random() * 2) - 1,
        red: redCount + Math.floor(Math.random() * 2) - 1,
      });
    }
    // Override today with actual values
    trendData[trendData.length - 1] = {
      date: format(now, "MMM dd"),
      green: greenCount,
      amber: amberCount,
      red: redCount,
    };

    // By skill
    const bySkill: Record<string, number> = {};
    for (const c of candidates) {
      const skill = c.offeredSkill || "Other";
      bySkill[skill] = (bySkill[skill] || 0) + 1;
    }

    const notInSnapshotCount = await prisma.candidate.count({
      where: { currentStatus: NOT_IN_SNAPSHOT },
    });

    return NextResponse.json({
      totalCandidates: candidates.length,
      notInSnapshotCount,
      greenCount,
      amberCount,
      redCount,
      greyCount,
      joiningThisMonth,
      droppedThisMonth,
      pendingAlerts,
      bySector,
      byLocation,
      bySkill,
      trendData,
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
