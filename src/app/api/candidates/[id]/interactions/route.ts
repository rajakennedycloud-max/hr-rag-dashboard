import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createInteractionSchema, formatZodError } from "@/lib/validations";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const interactions = await prisma.interaction.findMany({
      where: { candidateId: params.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(interactions);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch interactions" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const body = await req.json();
    const parsed = createInteractionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const data = parsed.data;

    // Simple sentiment analysis based on keywords
    const sentiment = analyzeSentiment(data.summary + " " + (data.details || ""));

    const interaction = await prisma.interaction.create({
      data: {
        candidateId: params.id,
        userId: data.userId ?? session.user.id,
        type: data.type || "NOTE",
        summary: data.summary,
        details: data.details,
        sentiment,
      },
      include: { user: { select: { name: true, email: true } } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: body.userId,
        entityType: "INTERACTION",
        entityId: interaction.id,
        action: "CREATE",
        newValue: JSON.stringify({ type: body.type, summary: body.summary }),
        description: `New ${body.type} interaction recorded for candidate`,
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create interaction" }, { status: 500 });
  }
}

function analyzeSentiment(text: string): string {
  const lower = text.toLowerCase();
  const positiveWords = [
    "excited", "happy", "looking forward", "confirmed", "accepted",
    "positive", "enthusiastic", "willing", "ready", "completed",
    "submitted", "agreed", "yes", "great", "good", "done",
  ];
  const negativeWords = [
    "not reachable", "unreachable", "declined", "counter", "retention",
    "hesitant", "doubt", "delay", "issue", "problem", "not interested",
    "withdrawn", "rejected", "concern", "risk", "dropped", "no response",
    "ghosting", "unresponsive",
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lower.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount) return "POSITIVE";
  if (negativeCount > positiveCount) return "NEGATIVE";
  return "NEUTRAL";
}
