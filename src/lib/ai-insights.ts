import type { AIInsight } from "@/types";
import { ACTIVE_STATUSES } from "@/lib/constants";

interface CandidateForAI {
  id: string;
  candidateName: string;
  ragScore: number;
  ragColor: string;
  currentStatus: string;
  expectedDOJ: Date | string;
  offerExtendedDate: Date | string;
  resignationReceived: boolean;
  preJoiningConnect1?: string | null;
  preJoiningConnect2?: string | null;
  kycCompleted: boolean;
  lwdConfirmed: boolean;
  counterOfferReceived: boolean;
  activeOnJobPortal: boolean;
  sector?: string | null;
  offeredSkill?: string | null;
  interactions?: Array<{ sentiment?: string | null; type: string; createdAt: Date | string }>;
}

// Rule-based AI insights engine (works without OpenAI API key)
// When OPENAI_API_KEY is configured, enhanced insights use GPT-4
export function generateLocalInsights(candidates: CandidateForAI[]): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date();

  for (const c of candidates) {
    const doj = new Date(c.expectedDOJ);
    const daysToJoin = Math.ceil((doj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // High risk: counter offer + active on job portal
    if (c.counterOfferReceived && c.activeOnJobPortal) {
      insights.push({
        id: `risk-dual-${c.id}`,
        type: "RISK",
        severity: "HIGH",
        title: "Dual Risk Detected",
        description: `${c.candidateName} has received a counter offer AND is active on job portals. This is a strong drop signal.`,
        candidateId: c.id,
        candidateName: c.candidateName,
        actionable: true,
        suggestedAction:
          "Immediately schedule a call with the candidate. Consider involving the hiring manager for a personal connect.",
        confidence: 0.92,
        createdAt: now.toISOString(),
      });
    }

    // Missed connects pattern
    if (
      c.preJoiningConnect1 === "NOT_REACHABLE" &&
      c.preJoiningConnect2 === "NOT_REACHABLE"
    ) {
      insights.push({
        id: `risk-unreachable-${c.id}`,
        type: "RISK",
        severity: "HIGH",
        title: "Candidate Unreachable Pattern",
        description: `${c.candidateName} was unreachable in both pre-joining connects. High probability of offer drop.`,
        candidateId: c.id,
        candidateName: c.candidateName,
        actionable: true,
        suggestedAction:
          "Try alternate contact methods (personal email, LinkedIn). Alert hiring manager to begin backup planning.",
        confidence: 0.88,
        createdAt: now.toISOString(),
      });
    }

    // Late resignation proof
    if (!c.resignationReceived && daysToJoin < 30) {
      insights.push({
        id: `risk-noresign-${c.id}`,
        type: "RISK",
        severity: daysToJoin < 14 ? "HIGH" : "MEDIUM",
        title: "Resignation Proof Missing",
        description: `${c.candidateName} has not submitted resignation proof with only ${daysToJoin} days to DOJ.`,
        candidateId: c.id,
        candidateName: c.candidateName,
        actionable: true,
        suggestedAction:
          "Request resignation acceptance letter urgently. Verify candidate's intent to join.",
        confidence: 0.85,
        createdAt: now.toISOString(),
      });
    }

    // KYC + LWD both pending close to DOJ
    if (!c.kycCompleted && !c.lwdConfirmed && daysToJoin < 14) {
      insights.push({
        id: `risk-kyc-lwd-${c.id}`,
        type: "RISK",
        severity: "HIGH",
        title: "Multiple Pre-joining Items Pending",
        description: `${c.candidateName} has both KYC and LWD confirmation pending with ${daysToJoin} days to DOJ.`,
        candidateId: c.id,
        candidateName: c.candidateName,
        actionable: true,
        suggestedAction:
          "Prioritize KYC completion immediately. Confirm last working day with current employer.",
        confidence: 0.9,
        createdAt: now.toISOString(),
      });
    }

    // Score declining trend detection
    if (c.ragColor === "RED" && c.ragScore < 40) {
      insights.push({
        id: `risk-critical-${c.id}`,
        type: "ANOMALY",
        severity: "HIGH",
        title: "Critical Risk Score",
        description: `${c.candidateName}'s score has dropped to ${Math.round(c.ragScore)}%. Immediate intervention needed.`,
        candidateId: c.id,
        candidateName: c.candidateName,
        actionable: true,
        suggestedAction:
          "Escalate to TA lead. Initiate backup hiring process. Schedule urgent connect with candidate.",
        confidence: 0.95,
        createdAt: now.toISOString(),
      });
    }
  }

  // Pattern-level insights
  const redCandidates = candidates.filter((c) => c.ragColor === "RED");
  const totalActive = candidates.filter((c) => ACTIVE_STATUSES.includes(c.currentStatus)).length;

  if (redCandidates.length > 0 && totalActive > 0) {
    const redPercent = Math.round((redCandidates.length / totalActive) * 100);
    if (redPercent > 30) {
      insights.push({
        id: `pattern-high-red-rate`,
        type: "PATTERN",
        severity: "HIGH",
        title: "High Red Rate Across Pipeline",
        description: `${redPercent}% of active candidates are in RED status (${redCandidates.length}/${totalActive}). This indicates systemic engagement issues.`,
        actionable: true,
        suggestedAction:
          "Review TA engagement processes. Consider increasing connect frequency or implementing additional candidate engagement programs.",
        confidence: 0.87,
        createdAt: now.toISOString(),
      });
    }
  }

  // Sector-specific patterns
  const sectorGroups: Record<string, CandidateForAI[]> = {};
  for (const c of candidates) {
    const sector = c.sector || "Unknown";
    if (!sectorGroups[sector]) sectorGroups[sector] = [];
    sectorGroups[sector].push(c);
  }

  for (const [sector, group] of Object.entries(sectorGroups)) {
    const sectorRed = group.filter((c) => c.ragColor === "RED").length;
    if (sectorRed >= 3) {
      insights.push({
        id: `pattern-sector-${sector}`,
        type: "PATTERN",
        severity: "MEDIUM",
        title: `Sector Risk: ${sector}`,
        description: `${sectorRed} candidates in the ${sector} sector are at RED status. Consider sector-specific retention strategies.`,
        actionable: true,
        suggestedAction: `Review offer competitiveness for ${sector}. Engage hiring managers in candidate connects.`,
        confidence: 0.78,
        createdAt: now.toISOString(),
      });
    }
  }

  // Positive recommendations
  const greenCandidates = candidates.filter(
    (c) => c.ragColor === "GREEN" && c.ragScore >= 80
  );
  if (greenCandidates.length > 0) {
    insights.push({
      id: `recommendation-green-champions`,
      type: "RECOMMENDATION",
      severity: "LOW",
      title: "High-confidence Joiners",
      description: `${greenCandidates.length} candidate(s) have scores above 80%. These are highly likely to join.`,
      actionable: true,
      suggestedAction:
        "Prioritize onboarding preparation for these candidates. Assign mentors and prepare Day 1 materials.",
      confidence: 0.93,
      createdAt: now.toISOString(),
    });
  }

  // Sort by severity
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  insights.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return insights;
}

// Enhanced AI insights using OpenAI (when API key is available)
export async function generateAIInsights(
  candidates: CandidateForAI[]
): Promise<AIInsight[]> {
  const localInsights = generateLocalInsights(candidates);

  // If no OpenAI key, return rule-based insights
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-openai-api-key-here") {
    return localInsights;
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const candidateSummary = candidates.slice(0, 20).map((c) => ({
      name: c.candidateName,
      score: c.ragScore,
      color: c.ragColor,
      daysToJoin: Math.ceil(
        (new Date(c.expectedDOJ).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
      resignationReceived: c.resignationReceived,
      connects: [c.preJoiningConnect1, c.preJoiningConnect2],
      counterOffer: c.counterOfferReceived,
      activeOnPortal: c.activeOnJobPortal,
      sector: c.sector,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an HR analytics AI assistant. Analyze candidate pipeline data and provide actionable insights for talent acquisition specialists. Focus on:
1. Risk patterns across candidates
2. Specific recommendations for at-risk candidates
3. Positive trends and reinforcement
4. Resource planning suggestions
Return JSON array of insights with fields: type (RISK/RECOMMENDATION/PATTERN/ANOMALY), severity (HIGH/MEDIUM/LOW), title, description, suggestedAction, confidence (0-1).`,
        },
        {
          role: "user",
          content: `Analyze this candidate pipeline:\n${JSON.stringify(candidateSummary, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        const aiResults = JSON.parse(content);
        const enhancedInsights: AIInsight[] = aiResults.map(
          (r: any, i: number) => ({
            id: `ai-${Date.now()}-${i}`,
            type: r.type || "RECOMMENDATION",
            severity: r.severity || "MEDIUM",
            title: r.title,
            description: r.description,
            actionable: true,
            suggestedAction: r.suggestedAction,
            confidence: r.confidence || 0.7,
            createdAt: new Date().toISOString(),
          })
        );
        return [...localInsights, ...enhancedInsights];
      } catch {
        return localInsights;
      }
    }

    return localInsights;
  } catch (error) {
    console.error("OpenAI API error, falling back to local insights:", error);
    return localInsights;
  }
}
