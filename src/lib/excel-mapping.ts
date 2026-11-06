// Mapping layer for the "Candidate Report" Excel export (SR/ATS system).
// Headers are matched exactly as they appear in the source workbook so the
// file can be imported as-is, without any format changes by the HR team.

export interface CandidateRow {
  reqNumber: string;
  reqTitle: string | null;
  reqType: string | null;
  recruiterName: string | null;
  candidateExternalId: string;
  candidateName: string;
  mobileNumber: string | null;
  email: string;
  candidateSource: string | null;
  currentStatus: string;
  expectedDOJ: Date;
  joiningMonth: string;
  earliestOfferDate: Date | null;
  offerExtendedDate: Date;
  offerRoleTitle: string | null;
  offerLocation: string | null;
  offerCity: string | null;
  employeeClassification: string | null;
  experience: string | null;
  sector: string | null;
  portfolio: string | null;
  project: string | null;
  customer: string | null;
  actualCustomer: string | null;
  department: string | null;
  prfPractice: string | null;
  prfPlatform: string | null;
  prfPrimarySkill: string | null;
  offeredSkill: string | null;
  prfGrade: string | null;
  offeredLevel: string | null;
  hiringManagerEmail: string | null;
  activeDays: number | null;
  ageingBucket: string | null;
  relocationEligibility: boolean | null;
  prfJobStream: string | null;
  offeredJobStream: string | null;
}

type StringField = {
  [K in keyof CandidateRow]: CandidateRow[K] extends string | null ? K : never;
}[keyof CandidateRow];

const STRING_COLUMNS: Record<string, StringField> = {
  "Requisition NO": "reqNumber",
  "Requisition Title": "reqTitle",
  "Requisition Type": "reqType",
  "Recruiter": "recruiterName",
  "Candidate ID": "candidateExternalId",
  "Candidate Full Name": "candidateName",
  "Mobile Phone": "mobileNumber",
  "Email": "email",
  "Candidate Source": "candidateSource",
  "Joining Month- Year": "joiningMonth",
  "Offer Role Title": "offerRoleTitle",
  "Offer Location": "offerLocation",
  "Offer City": "offerCity",
  "Employee Classification Value": "employeeClassification",
  "Experience": "experience",
  "Sector": "sector",
  "Portfolio": "portfolio",
  "Project": "project",
  "Customer": "customer",
  "Actual Customer": "actualCustomer",
  "Department": "department",
  "PRF Practice": "prfPractice",
  "PRF Platform": "prfPlatform",
  "PRF Primary Skill": "prfPrimarySkill",
  "Offer Skill": "offeredSkill",
  "PRF Grade": "prfGrade",
  "Offer Level": "offeredLevel",
  "Hiring Manager Email": "hiringManagerEmail",
  "Ageing Bucket": "ageingBucket",
  "Prf Job Stream": "prfJobStream",
  "Offered Job Stream": "offeredJobStream",
};

const STATUS_MAP: Record<string, string> = {
  offered: "OFFERED",
  "offer pending acceptance": "OFFER_PENDING",
  joined: "JOINED",
  dropped: "DROPPED",
  "on hold": "ON_HOLD",
};

function clean(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

// Handles Excel serial numbers and DD-MM-YYYY / YYYY-MM-DD / MM/DD/YYYY strings.
export function parseExcelDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;

  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30, accounting for the 1900 leap bug)
    const adjusted = value > 59 ? value - 1 : value;
    return new Date(Date.UTC(1899, 11, 31) + adjusted * 86400000);
  }

  const s = String(value).trim();
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY (source workbook format)
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // MM/DD/YYYY
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface ParsedRow {
  data?: CandidateRow;
  error?: string;
}

// Converts a raw sheet row (keyed by source headers) into a CandidateRow.
export function mapRow(row: Record<string, unknown>): ParsedRow {
  const get = (h: string) => clean(row[h]);

  const candidateExternalId = get("Candidate ID");
  const candidateName = get("Candidate Full Name");
  const email = get("Email");
  const expectedDOJ = parseExcelDate(row["Expected Date of Joining"]);
  const offerExtendedDate = parseExcelDate(row["Offer Extended Date"]);

  const missing: string[] = [];
  if (!candidateExternalId) missing.push("Candidate ID");
  if (!candidateName) missing.push("Candidate Full Name");
  if (!email) missing.push("Email");
  if (!expectedDOJ) missing.push("Expected Date of Joining (valid date)");
  if (!offerExtendedDate) missing.push("Offer Extended Date (valid date)");

  if (missing.length > 0) {
    return { error: `Missing/invalid: ${missing.join(", ")}` };
  }

  const rawStatus = get("Current Status")?.toLowerCase() ?? "";
  const currentStatus = STATUS_MAP[rawStatus] ?? "OFFERED";

  const joiningMonth =
    get("Joining Month- Year") ??
    expectedDOJ!.toLocaleDateString("en-US", { month: "2-digit", year: "numeric", timeZone: "UTC" });

  const activeDaysRaw = get("Active Days");
  const activeDays = activeDaysRaw && !isNaN(Number(activeDaysRaw)) ? parseInt(activeDaysRaw, 10) : null;

  const relocationRaw = get("Relocation Eligibility")?.toLowerCase();
  const relocationEligibility =
    relocationRaw === "true" ? true : relocationRaw === "false" ? false : null;

  const data: CandidateRow = {
    reqNumber: get("Requisition NO") ?? `REQ-${candidateExternalId!.slice(0, 8)}`,
    reqTitle: get("Requisition Title"),
    reqType: get("Requisition Type"),
    recruiterName: get("Recruiter"),
    candidateExternalId: candidateExternalId!,
    candidateName: candidateName!,
    mobileNumber: get("Mobile Phone"),
    email: email!,
    candidateSource: get("Candidate Source"),
    currentStatus,
    expectedDOJ: expectedDOJ!,
    joiningMonth,
    earliestOfferDate: parseExcelDate(row["Earliest Date of Offer"]),
    offerExtendedDate: offerExtendedDate!,
    offerRoleTitle: get("Offer Role Title"),
    offerLocation: get("Offer Location"),
    offerCity: get("Offer City"),
    employeeClassification: get("Employee Classification Value"),
    experience: get("Experience"),
    sector: get("Sector"),
    portfolio: get("Portfolio"),
    project: get("Project"),
    customer: get("Customer"),
    actualCustomer: get("Actual Customer"),
    department: get("Department"),
    prfPractice: get("PRF Practice"),
    prfPlatform: get("PRF Platform"),
    prfPrimarySkill: get("PRF Primary Skill"),
    offeredSkill: get("Offer Skill"),
    prfGrade: get("PRF Grade"),
    offeredLevel: get("Offer Level"),
    hiringManagerEmail: get("Hiring Manager Email"),
    activeDays,
    ageingBucket: get("Ageing Bucket"),
    relocationEligibility,
    prfJobStream: get("Prf Job Stream"),
    offeredJobStream: get("Offered Job Stream"),
  };

  return { data };
}

// Fields compared when detecting delta changes between daily snapshots.
// recruiterName maps to a relation and is compared separately.
export const DELTA_FIELDS: (keyof CandidateRow)[] = [
  "reqNumber", "reqTitle", "reqType", "candidateName", "mobileNumber", "email",
  "candidateSource", "currentStatus", "expectedDOJ", "joiningMonth",
  "earliestOfferDate", "offerExtendedDate", "offerRoleTitle", "offerLocation",
  "offerCity", "employeeClassification", "experience", "sector", "portfolio",
  "project", "customer", "actualCustomer", "department", "prfPractice",
  "prfPlatform", "prfPrimarySkill", "offeredSkill", "prfGrade", "offeredLevel",
  "hiringManagerEmail", "activeDays", "ageingBucket", "relocationEligibility",
  "prfJobStream", "offeredJobStream",
];

// "Pawan SHARMA" -> pawan.sharma@hrtest.com ; single names -> name@hrtest.com
export function recruiterEmailFromName(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const local = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
  return `${local.replace(/[^a-z0-9.]/g, "")}@hrtest.com`;
}
