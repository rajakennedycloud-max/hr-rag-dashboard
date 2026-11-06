import { z, ZodError } from "zod";

export const candidateQuerySchema = z.object({
  status: z.string().optional(),
  ragColor: z.enum(["RED", "AMBER", "GREEN", "GREY"]).optional(),
  sector: z.string().optional(),
  recruiterId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const createCandidateSchema = z.object({
  reqNumber: z.string().min(1),
  candidateExternalId: z.string().min(1),
  candidateName: z.string().min(1),
  email: z.string().email(),
  mobileNumber: z.string().optional().nullable(),
  currentStatus: z.string().default("OFFERED"),
  expectedDOJ: z.coerce.date(),
  offerExtendedDate: z.coerce.date(),
  offerLocation: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  actualCustomer: z.string().optional().nullable(),
  offeredSkill: z.string().optional().nullable(),
  offeredLevel: z.string().optional().nullable(),
  hiringManagerEmail: z.string().email().optional().nullable(),
  joiningMonth: z.string().optional(),
  employeeClassification: z.string().optional().nullable(),
  recruiterId: z.string().optional().nullable(),
});

export const updateCandidateSchema = z.object({
  candidateName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  mobileNumber: z.string().optional().nullable(),
  currentStatus: z.string().optional(),
  expectedDOJ: z.coerce.date().optional(),
  offerExtendedDate: z.coerce.date().optional(),
  offerLocation: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  actualCustomer: z.string().optional().nullable(),
  offeredSkill: z.string().optional().nullable(),
  offeredLevel: z.string().optional().nullable(),
  hiringManagerEmail: z.string().email().optional().nullable(),
  preJoiningConnect1: z.enum(["COMPLETED", "PENDING", "NOT_REACHABLE"]).optional().nullable(),
  preJoiningConnect1Date: z.coerce.date().optional().nullable(),
  preJoiningConnect2: z.enum(["COMPLETED", "PENDING", "NOT_REACHABLE"]).optional().nullable(),
  preJoiningConnect2Date: z.coerce.date().optional().nullable(),
  resignationReceived: z.boolean().optional(),
  resignationReceivedAt: z.coerce.date().optional().nullable(),
  kycCompleted: z.boolean().optional(),
  kycCompletedAt: z.coerce.date().optional().nullable(),
  lwdConfirmed: z.boolean().optional(),
  lwdConfirmedAt: z.coerce.date().optional().nullable(),
  counterOfferReceived: z.boolean().optional(),
  activeOnJobPortal: z.boolean().optional(),
  candidateDemands: z.string().optional().nullable(),
  recruiterRemarks: z.string().optional().nullable(),
  recruiterId: z.string().optional().nullable(),
  resignationProofUrl: z.string().optional().nullable(),
  resignationProofFile: z.string().optional().nullable(),
  kycDocumentsFile: z.string().optional().nullable(),
  resumeFile: z.string().optional().nullable(),
  remarkReason: z.string().optional().nullable(),
  userId: z.string().optional(),
});

export const alertQuerySchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  candidateId: z.string().optional(),
  assignedToId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateAlertSchema = z.object({
  alertId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"]),
  userId: z.string().optional(),
});

export const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createInteractionSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "SYSTEM"]),
  summary: z.string().min(1),
  details: z.string().optional().nullable(),
});

export function formatZodError(error: ZodError) {
  return {
    error: "Validation failed",
    details: error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })),
  };
}
