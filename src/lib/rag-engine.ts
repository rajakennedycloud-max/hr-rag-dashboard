import { differenceInDays, addDays, isAfter, isBefore } from "date-fns";
import type { RagColor, RagScoreBreakdown } from "@/types";
import {
  shouldRagBeActive,
  getConnect1DueDate,
  getConnect2DueDate,
  getRagActivationDate,
} from "./utils";

export interface CandidateRagInput {
  offerExtendedDate: Date;
  expectedDOJ: Date;
  resignationReceived: boolean;
  resignationReceivedAt?: Date | null;
  preJoiningConnect1?: string | null; // COMPLETED, PENDING, NOT_REACHABLE
  preJoiningConnect1Date?: Date | null;
  preJoiningConnect2?: string | null;
  preJoiningConnect2Date?: Date | null;
  kycCompleted: boolean;
  kycCompletedAt?: Date | null;
  lwdConfirmed: boolean;
  lwdConfirmedAt?: Date | null;
  counterOfferReceived: boolean;
  activeOnJobPortal: boolean;
  currentStatus: string;
}

const WEIGHTS = {
  BASE: 50,
  RESIGNATION: 10,
  CONNECT_1: 10,
  CONNECT_2: 10,
  KYC: 5,
  LWD: 5,
  COUNTER_OFFER: 5,
  JOB_PORTAL: 5,
} as const;

export function computeRagScore(
  candidate: CandidateRagInput,
  now: Date = new Date()
): RagScoreBreakdown {
  let score: number = WEIGHTS.BASE;
  const breakdown: RagScoreBreakdown = {
    base: WEIGHTS.BASE,
    resignation: 0,
    connect1: 0,
    connect2: 0,
    kyc: 0,
    lwd: 0,
    counterOffer: 0,
    jobPortal: 0,
    total: WEIGHTS.BASE,
    color: "GREY",
  };

  const offerDate = new Date(candidate.offerExtendedDate);
  const doj = new Date(candidate.expectedDOJ);
  const totalDuration = differenceInDays(doj, offerDate);
  const daysElapsed = differenceInDays(now, offerDate);

  // 1. Resignation mail received within 48 hours
  const resignationDeadline = addDays(offerDate, 2);
  if (isAfter(now, resignationDeadline) || candidate.resignationReceived) {
    if (candidate.resignationReceived) {
      const receivedWithin48h = candidate.resignationReceivedAt
        ? isBefore(new Date(candidate.resignationReceivedAt), resignationDeadline)
        : false;
      breakdown.resignation = receivedWithin48h
        ? WEIGHTS.RESIGNATION
        : WEIGHTS.RESIGNATION * 0.5; // partial credit if late
      score += breakdown.resignation;
    } else {
      breakdown.resignation = -WEIGHTS.RESIGNATION;
      score += breakdown.resignation;
    }
  }

  // 2. Pre-joining connect 1 at 33% of DOJ duration
  const connect1Due = getConnect1DueDate(offerDate, doj);
  if (isAfter(now, connect1Due) || candidate.preJoiningConnect1 === "COMPLETED") {
    if (candidate.preJoiningConnect1 === "COMPLETED") {
      breakdown.connect1 = WEIGHTS.CONNECT_1;
    } else if (candidate.preJoiningConnect1 === "NOT_REACHABLE") {
      breakdown.connect1 = -WEIGHTS.CONNECT_1;
    } else {
      // PENDING or null past due date
      breakdown.connect1 = -WEIGHTS.CONNECT_1;
    }
    score += breakdown.connect1;
  }

  // 3. Pre-joining connect 2 at 66% of DOJ duration
  const connect2Due = getConnect2DueDate(offerDate, doj);
  if (isAfter(now, connect2Due) || candidate.preJoiningConnect2 === "COMPLETED") {
    if (candidate.preJoiningConnect2 === "COMPLETED") {
      breakdown.connect2 = WEIGHTS.CONNECT_2;
    } else if (candidate.preJoiningConnect2 === "NOT_REACHABLE") {
      breakdown.connect2 = -WEIGHTS.CONNECT_2;
    } else {
      breakdown.connect2 = -WEIGHTS.CONNECT_2;
    }
    score += breakdown.connect2;
  }

  // 4. KYC completion - 2 weeks prior to DOJ
  const kycDeadline = addDays(doj, -14);
  if (isAfter(now, kycDeadline) || candidate.kycCompleted) {
    if (candidate.kycCompleted) {
      breakdown.kyc = WEIGHTS.KYC;
    } else {
      breakdown.kyc = -WEIGHTS.KYC;
    }
    score += breakdown.kyc;
  }

  // 5. LWD confirmation - 1 week prior to DOJ
  const lwdDeadline = addDays(doj, -7);
  if (isAfter(now, lwdDeadline) || candidate.lwdConfirmed) {
    if (candidate.lwdConfirmed) {
      breakdown.lwd = WEIGHTS.LWD;
    } else {
      breakdown.lwd = -WEIGHTS.LWD;
    }
    score += breakdown.lwd;
  }

  // 6. Counter offer / retention (dynamic - resets each check)
  if (candidate.counterOfferReceived) {
    breakdown.counterOffer = -WEIGHTS.COUNTER_OFFER;
    score += breakdown.counterOffer;
  } else {
    breakdown.counterOffer = WEIGHTS.COUNTER_OFFER;
    score += breakdown.counterOffer;
  }

  // 7. Active on job portal (dynamic - resets each check)
  if (candidate.activeOnJobPortal) {
    breakdown.jobPortal = -WEIGHTS.JOB_PORTAL;
    score += breakdown.jobPortal;
  } else {
    breakdown.jobPortal = WEIGHTS.JOB_PORTAL;
    score += breakdown.jobPortal;
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));
  breakdown.total = score;

  // Determine RAG color
  const ragActive = shouldRagBeActive(offerDate, doj, now);
  if (!ragActive) {
    breakdown.color = "GREY";
  } else {
    breakdown.color = getColorFromScore(score);
  }

  return breakdown;
}

export function getColorFromScore(score: number): RagColor {
  if (score >= 60) return "GREEN";
  if (score >= 50) return "AMBER";
  return "RED";
}

export function computeScoreChanges(
  oldInput: CandidateRagInput,
  newInput: CandidateRagInput,
  now: Date = new Date()
): Array<{
  parameter: string;
  oldScore: number;
  newScore: number;
  impact: number;
  reason: string;
}> {
  const changes: Array<{
    parameter: string;
    oldScore: number;
    newScore: number;
    impact: number;
    reason: string;
  }> = [];

  const oldBreakdown = computeRagScore(oldInput, now);
  const newBreakdown = computeRagScore(newInput, now);

  const parameters: Array<{
    key: keyof RagScoreBreakdown;
    name: string;
  }> = [
    { key: "resignation", name: "RESIGNATION" },
    { key: "connect1", name: "CONNECT_1" },
    { key: "connect2", name: "CONNECT_2" },
    { key: "kyc", name: "KYC" },
    { key: "lwd", name: "LWD" },
    { key: "counterOffer", name: "COUNTER_OFFER" },
    { key: "jobPortal", name: "JOB_PORTAL" },
  ];

  for (const param of parameters) {
    const oldVal = oldBreakdown[param.key] as number;
    const newVal = newBreakdown[param.key] as number;
    if (oldVal !== newVal) {
      changes.push({
        parameter: param.name,
        oldScore: oldBreakdown.total,
        newScore: newBreakdown.total,
        impact: newVal - oldVal,
        reason: getChangeReason(param.name, newVal > oldVal),
      });
    }
  }

  return changes;
}

function getChangeReason(parameter: string, positive: boolean): string {
  const reasons: Record<string, [string, string]> = {
    RESIGNATION: [
      "Resignation email/proof received",
      "Resignation email not received within deadline",
    ],
    CONNECT_1: [
      "Pre-joining connect 1 completed successfully",
      "Pre-joining connect 1 missed or candidate not reachable",
    ],
    CONNECT_2: [
      "Pre-joining connect 2 completed successfully",
      "Pre-joining connect 2 missed or candidate not reachable",
    ],
    KYC: ["KYC documentation completed", "KYC documentation pending past deadline"],
    LWD: [
      "Last working day confirmed",
      "Last working day not confirmed within deadline",
    ],
    COUNTER_OFFER: [
      "No counter offer detected",
      "Counter offer / retention attempt detected",
    ],
    JOB_PORTAL: [
      "Not active on job portals",
      "Active on job portals detected",
    ],
  };

  const [positiveReason, negativeReason] = reasons[parameter] || [
    "Positive change",
    "Negative change",
  ];
  return positive ? positiveReason : negativeReason;
}

export function getDynamicCheckSchedule(
  doj: Date,
  now: Date = new Date()
): { checkNumber: number; scheduledDate: Date }[] {
  const remainingDays = differenceInDays(doj, now);
  if (remainingDays <= 0) return [];

  const interval = Math.max(1, Math.floor(remainingDays * 0.2));
  const checks: { checkNumber: number; scheduledDate: Date }[] = [];
  let checkNum = 1;
  let checkDate = addDays(now, interval);

  while (isBefore(checkDate, doj) && checkNum <= 5) {
    checks.push({ checkNumber: checkNum, scheduledDate: checkDate });
    checkNum++;
    checkDate = addDays(checkDate, interval);
  }

  return checks;
}
