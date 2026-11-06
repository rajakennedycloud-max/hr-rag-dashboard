import { addDays, addBusinessDays, isBefore, isAfter, differenceInDays } from "date-fns";
import type { AlertType, AlertPriority } from "@/types";
import { formatDate } from "@/lib/date-utils";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { shouldRagBeActive } from "@/lib/utils";

export interface AlertDefinition {
  type: AlertType;
  title: string;
  description: string;
  dueDate: Date;
  priority: AlertPriority;
}

export interface CandidateAlertInput {
  candidateId: string;
  candidateName: string;
  offerExtendedDate: Date;
  expectedDOJ: Date;
  resignationReceived: boolean;
  preJoiningConnect1?: string | null;
  preJoiningConnect2?: string | null;
  kycCompleted: boolean;
  lwdConfirmed: boolean;
  currentStatus: string;
  lastRiskCheckAt?: Date | null;
}

export function generateAlerts(
  candidate: CandidateAlertInput,
  now: Date = new Date()
): AlertDefinition[] {
  const alerts: AlertDefinition[] = [];
  const offerDate = new Date(candidate.offerExtendedDate);
  const doj = new Date(candidate.expectedDOJ);
  const totalDuration = differenceInDays(doj, offerDate);

  if (!ACTIVE_STATUSES.includes(candidate.currentStatus)) return alerts;

  // 1. Resignation mail pending - 24 hours after offer
  if (!candidate.resignationReceived) {
    const resignationDue = addDays(offerDate, 1);
    if (isAfter(now, resignationDue)) {
      alerts.push({
        type: "RESIGNATION_PENDING",
        title: `Resignation proof pending - ${candidate.candidateName}`,
        description: `Resignation email/proof not received. Offer extended on ${formatDate(offerDate)}.`,
        dueDate: addDays(offerDate, 2),
        priority: getPriorityByUrgency(differenceInDays(addDays(offerDate, 2), now)),
      });
    }
  }

  // 2. Pre-joining connect 1 - 5 working days before scheduled date
  if (candidate.preJoiningConnect1 !== "COMPLETED") {
    const connect1Date = addDays(offerDate, Math.floor(totalDuration * 0.33));
    const connect1AlertDate = addBusinessDays(connect1Date, -5);
    if (isAfter(now, connect1AlertDate) && isBefore(now, doj)) {
      alerts.push({
        type: "CONNECT_1_DUE",
        title: `Pre-joining connect 1 due - ${candidate.candidateName}`,
        description: `Scheduled for ${formatDate(connect1Date)}. Please reach out to the candidate.`,
        dueDate: connect1Date,
        priority: getPriorityByUrgency(differenceInDays(connect1Date, now)),
      });
    }
  }

  // 3. Pre-joining connect 2 - 5 working days before scheduled date
  if (candidate.preJoiningConnect2 !== "COMPLETED") {
    const connect2Date = addDays(offerDate, Math.floor(totalDuration * 0.66));
    const connect2AlertDate = addBusinessDays(connect2Date, -5);
    if (isAfter(now, connect2AlertDate) && isBefore(now, doj)) {
      alerts.push({
        type: "CONNECT_2_DUE",
        title: `Pre-joining connect 2 due - ${candidate.candidateName}`,
        description: `Scheduled for ${formatDate(connect2Date)}. Please reach out to the candidate.`,
        dueDate: connect2Date,
        priority: getPriorityByUrgency(differenceInDays(connect2Date, now)),
      });
    }
  }

  // 4. Periodic risk check (job portal + counter offer) - every 20% of
  // remaining DOJ days, only while RAG is active and no check was
  // completed within the last interval.
  const remainingDays = differenceInDays(doj, now);
  if (remainingDays > 0 && shouldRagBeActive(offerDate, doj, now)) {
    const interval = Math.max(1, Math.floor(remainingDays * 0.2));
    const lastCheck = candidate.lastRiskCheckAt ?? null;
    if (!lastCheck || differenceInDays(now, lastCheck) >= interval) {
      alerts.push({
        type: "RISK_CHECK",
        title: `Periodic risk check - ${candidate.candidateName}`,
        description: "Verify job-portal activity and counter-offer status.",
        dueDate: lastCheck ? addDays(lastCheck, interval) : now,
        priority: "MEDIUM",
      });
    }
  }

  // 6. KYC initiation - 12 working days before DOJ
  if (!candidate.kycCompleted) {
    const kycAlertDate = addBusinessDays(doj, -12);
    if (isAfter(now, kycAlertDate) && isBefore(now, doj)) {
      alerts.push({
        type: "KYC_DUE",
        title: `KYC initiation pending - ${candidate.candidateName}`,
        description: `KYC must be completed 2 weeks before DOJ (${formatDate(doj)}).`,
        dueDate: addBusinessDays(doj, -10),
        priority: getPriorityByUrgency(differenceInDays(addBusinessDays(doj, -10), now)),
      });
    }
  }

  // 7. LWD confirmation - 5 working days before DOJ
  if (!candidate.lwdConfirmed) {
    const lwdAlertDate = addBusinessDays(doj, -5);
    if (isAfter(now, lwdAlertDate) && isBefore(now, doj)) {
      alerts.push({
        type: "LWD_DUE",
        title: `LWD confirmation pending - ${candidate.candidateName}`,
        description: `Last working day must be confirmed before DOJ (${formatDate(doj)}).`,
        dueDate: addBusinessDays(doj, -3),
        priority: "CRITICAL",
      });
    }
  }

  return alerts;
}

function getPriorityByUrgency(daysRemaining: number): AlertPriority {
  if (daysRemaining <= 0) return "CRITICAL";
  if (daysRemaining <= 2) return "HIGH";
  if (daysRemaining <= 7) return "MEDIUM";
  return "LOW";
}

export function getAlertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    RESIGNATION_PENDING: "Resignation Pending",
    CONNECT_1_DUE: "Pre-joining Connect 1",
    CONNECT_2_DUE: "Pre-joining Connect 2",
    RISK_CHECK: "Periodic Risk Check",
    KYC_DUE: "KYC Initiation",
    LWD_DUE: "LWD Confirmation",
  };
  return labels[type] || type;
}
