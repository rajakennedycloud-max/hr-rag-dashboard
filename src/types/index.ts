export type RagColor = "RED" | "AMBER" | "GREEN" | "GREY";

export interface RagScoreBreakdown {
  base: number;
  resignation: number;
  connect1: number;
  connect2: number;
  kyc: number;
  lwd: number;
  counterOffer: number;
  jobPortal: number;
  total: number;
  color: RagColor;
}

export type AlertType =
  | "RESIGNATION_PENDING"
  | "CONNECT_1_DUE"
  | "CONNECT_2_DUE"
  | "RISK_CHECK"
  | "KYC_DUE"
  | "LWD_DUE";

export type AlertPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AIInsight {
  id: string;
  type: "RISK" | "PATTERN" | "RECOMMENDATION" | "POSITIVE" | "ANOMALY";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  candidateId?: string;
  candidateName?: string;
  actionable: boolean;
  suggestedAction?: string;
  confidence: number;
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  sector?: string | null;
}

export type CandidateStatus =
  | "OFFERED"
  | "OFFER_PENDING"
  | "JOINED"
  | "DROPPED"
  | "ON_HOLD";

export type UserRole = "TA_SPECIALIST" | "BUSINESS_HEAD" | "ADMIN";
