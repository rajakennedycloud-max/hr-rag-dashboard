"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/header";
import FileUpload from "@/components/file-upload";
import type { UserSession } from "@/types";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { getConnect1DueDate, getConnect2DueDate } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  FileText,
  History,
  Activity,
  Shield,
  X,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const RAG_COLORS: Record<string, string> = {
  GREEN: "#22C55E",
  AMBER: "#F59E0B",
  RED: "#EF4444",
  GREY: "#9CA3AF",
};

interface CandidateDetail {
  id: string;
  reqNumber: string;
  candidateExternalId: string;
  candidateName: string;
  mobileNumber: string | null;
  email: string;
  currentStatus: string;
  expectedDOJ: string;
  joiningMonth: string;
  offerExtendedDate: string;
  offerLocation: string | null;
  offerCity: string | null;
  reqTitle: string | null;
  offerRoleTitle: string | null;
  portfolio: string | null;
  customer: string | null;
  department: string | null;
  experience: string | null;
  prfGrade: string | null;
  ageingBucket: string | null;
  candidateSource: string | null;
  employeeClassification: string | null;
  sector: string | null;
  actualCustomer: string | null;
  offeredSkill: string | null;
  offeredLevel: string | null;
  hiringManagerEmail: string | null;
  preJoiningConnect1: string | null;
  preJoiningConnect1Date: string | null;
  preJoiningConnect2: string | null;
  preJoiningConnect2Date: string | null;
  resignationReceived: boolean;
  resignationReceivedAt: string | null;
  resignationProofUrl: string | null;
  resignationProofFile: string | null;
  kycCompleted: boolean;
  kycCompletedAt: string | null;
  kycDocumentsFile: string | null;
  lwdConfirmed: boolean;
  lwdConfirmedAt: string | null;
  counterOfferReceived: boolean;
  activeOnJobPortal: boolean;
  candidateDemands: string | null;
  recruiterRemarks: string | null;
  resumeFile: string | null;
  ragScore: number;
  ragColor: string;
  ragActivated: boolean;
  ragActivationDate: string | null;
  recruiterId: string | null;
  recruiter: { id: string; name: string; email: string } | null;
  scoreHistory: Array<{
    id: string;
    parameter: string;
    oldScore: number;
    newScore: number;
    impact: number;
    reason: string;
    createdAt: string;
  }>;
  ragTransitions: Array<{
    id: string;
    fromColor: string;
    toColor: string;
    fromScore: number;
    toScore: number;
    reason: string | null;
    createdAt: string;
  }>;
  interactions: Array<{
    id: string;
    type: string;
    summary: string;
    details: string | null;
    sentiment: string | null;
    createdAt: string;
    user: { name: string; email: string };
  }>;
  alerts: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
  }>;
  weeklyUpdates: Array<{
    id: string;
    weekNumber: number;
    updateText: string;
    ragColorAtTime: string;
    scoreAtTime: number;
    createdAt: string;
  }>;
}

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState<UserSession | null>(null);
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "history" | "interactions" | "alerts">("overview");

  // Interaction form
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: "CALL", summary: "", details: "" });

  // Remark edit form
  const [saving, setSaving] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  const [showRemarkEdit, setShowRemarkEdit] = useState(false);
  const [remarkForm, setRemarkForm] = useState({
    recruiterRemarks: "",
    candidateDemands: "",
    reason: ""
  });

  useEffect(() => {
    if (authStatus === "unauthenticated") { router.push("/"); return; }
    if (authStatus === "authenticated" && authSession?.user) {
      setSession({
        id: (authSession.user as any).id,
        email: authSession.user.email || "",
        name: authSession.user.name || "",
        role: (authSession.user as any).role || "TA_SPECIALIST",
        sector: (authSession.user as any).sector,
      });
    }
  }, [authSession, authStatus, router]);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/candidates/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setCandidate(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  const fetchCandidate = async () => {
    if (!params.id) return;
    const res = await fetch(`/api/candidates/${params.id}`);
    setCandidate(await res.json());
  };

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users) => {
        if (Array.isArray(users)) {
          setRecruiters(users.filter((u) => u.role === "TA_SPECIALIST" || u.role === "ADMIN"));
        }
      })
      .catch(() => {});
  }, []);

  const patch = async (fields: Record<string, unknown>) => {
    if (!session || !candidate) return;
    setSaving(true);
    setPatchError(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, userId: session.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPatchError(data.message || data.error || `Update failed (${res.status})`);
        return;
      }
      await fetchCandidate();
    } catch {
      setPatchError("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddInteraction = async () => {
    if (!session || !candidate) return;
    await fetch(`/api/candidates/${candidate.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...interactionForm, userId: session.id }),
    });
    setShowInteractionForm(false);
    setInteractionForm({ type: "CALL", summary: "", details: "" });
    // Reload
    await fetchCandidate();
  };

  const handleEditRemarks = async () => {
    if (!session || !candidate) return;
    await fetch(`/api/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ...remarkForm, 
        userId: session.id 
      }),
    });
    setShowRemarkEdit(false);
    setRemarkForm({ recruiterRemarks: "", candidateDemands: "", reason: "" });
    // Reload
    await fetchCandidate();
  };

  const openRemarkEdit = () => {
    if (!candidate) return;
    setRemarkForm({
      recruiterRemarks: candidate.recruiterRemarks || "",
      candidateDemands: candidate.candidateDemands || "",
      reason: ""
    });
    setShowRemarkEdit(true);
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header session={session} />
        <div className="max-w-4xl mx-auto py-20 text-center">
          <p className="text-gray-500">Candidate not found</p>
        </div>
      </div>
    );
  }

  const doj = new Date(candidate.expectedDOJ);
  const daysToJoin = Math.ceil((doj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const canEdit = ["TA_SPECIALIST", "ADMIN"].includes(session?.role ?? "");

  // Build score timeline data
  const scoreTimeline = candidate.scoreHistory
    .slice()
    .reverse()
    .map((sh) => ({
      date: formatDate(sh.createdAt),
      score: sh.newScore,
      event: sh.reason,
    }));

  // Add current score as last point if no history
  if (scoreTimeline.length === 0) {
    scoreTimeline.push({
      date: "Current",
      score: candidate.ragScore,
      event: "Initial score",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header session={session} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Candidate Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              {/* RAG Score Circle */}
              <div
                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${
                  candidate.ragColor === "RED" ? "rag-pulse-red" : candidate.ragColor === "AMBER" ? "rag-pulse-amber" : ""
                }`}
                style={{ backgroundColor: RAG_COLORS[candidate.ragColor] }}
              >
                <span className="text-2xl font-bold">{Math.round(candidate.ragScore)}</span>
                <span className="text-[10px] opacity-80">{candidate.ragColor}</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.candidateName}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {candidate.email}
                  </span>
                  {candidate.mobileNumber && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {candidate.mobileNumber}
                    </span>
                  )}
                  {candidate.offerLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {candidate.offerLocation}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg">
                    Req: {candidate.reqNumber}
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg">
                    ID: {candidate.candidateExternalId}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                    candidate.currentStatus === "OFFERED" ? "bg-blue-50 text-blue-700" :
                    candidate.currentStatus === "JOINED" ? "bg-green-50 text-green-700" :
                    candidate.currentStatus === "DROPPED" ? "bg-red-50 text-red-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {candidate.currentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500">Expected DOJ</div>
              <div className="text-lg font-bold text-gray-900">{formatDate(candidate.expectedDOJ)}</div>
              <div className={`text-sm font-medium mt-1 ${
                daysToJoin < 7 ? "text-red-600" : daysToJoin < 30 ? "text-amber-600" : "text-green-600"
              }`}>
                {daysToJoin > 0 ? `${daysToJoin} days remaining` : daysToJoin === 0 ? "Joining today" : "Past DOJ"}
              </div>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 mb-6 w-fit">
          {[
            { key: "overview", label: "Overview & Score", icon: Activity },
            { key: "history", label: "Score History", icon: History },
            { key: "interactions", label: `Interactions (${candidate.interactions.length})`, icon: MessageSquare },
            { key: "alerts", label: `Alerts (${candidate.alerts.length})`, icon: AlertTriangle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === key ? "bg-brand-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Score Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Score Parameters Grid */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Parameters</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Resignation Proof",
                      done: candidate.resignationReceived,
                      detail: candidate.resignationReceivedAt
                        ? `Received ${formatDate(candidate.resignationReceivedAt)}`
                        : "Pending",
                      weight: "10%",
                    },
                    {
                      label: "Pre-join Connect 1",
                      done: candidate.preJoiningConnect1 === "COMPLETED",
                      detail: candidate.preJoiningConnect1 || "Pending",
                      weight: "10%",
                      warn: candidate.preJoiningConnect1 === "NOT_REACHABLE",
                    },
                    {
                      label: "Pre-join Connect 2",
                      done: candidate.preJoiningConnect2 === "COMPLETED",
                      detail: candidate.preJoiningConnect2 || "Pending",
                      weight: "10%",
                      warn: candidate.preJoiningConnect2 === "NOT_REACHABLE",
                    },
                    {
                      label: "KYC Completed",
                      done: candidate.kycCompleted,
                      detail: candidate.kycCompletedAt
                        ? `Completed ${formatDate(candidate.kycCompletedAt)}`
                        : "Pending",
                      weight: "5%",
                    },
                    {
                      label: "LWD Confirmed",
                      done: candidate.lwdConfirmed,
                      detail: candidate.lwdConfirmedAt
                        ? `Confirmed ${formatDate(candidate.lwdConfirmedAt)}`
                        : "Pending",
                      weight: "5%",
                    },
                    {
                      label: "No Counter Offer",
                      done: !candidate.counterOfferReceived,
                      detail: candidate.counterOfferReceived ? "Counter offer detected!" : "Clear",
                      weight: "5%",
                      warn: candidate.counterOfferReceived,
                    },
                    {
                      label: "Not on Job Portals",
                      done: !candidate.activeOnJobPortal,
                      detail: candidate.activeOnJobPortal ? "Active on portals!" : "Clear",
                      weight: "5%",
                      warn: candidate.activeOnJobPortal,
                    },
                  ].map((param) => (
                    <div
                      key={param.label}
                      className={`p-3 rounded-xl border ${
                        param.done
                          ? "bg-green-50 border-green-200"
                          : param.warn
                          ? "bg-red-50 border-red-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        {param.done ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : param.warn ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-[10px] font-medium text-gray-400">
                          {param.weight}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-gray-900">{param.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{param.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Timeline Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Timeline</h3>
                {scoreTimeline.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={scoreTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload[0]) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-xs">
                                <div className="font-semibold">{data.date}</div>
                                <div className="text-brand-600 font-bold">{Math.round(data.score)}%</div>
                                <div className="text-gray-500 mt-1 max-w-[200px]">{data.event}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={60} stroke="#22C55E" strokeDasharray="3 3" label="Green" />
                      <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" label="Amber" />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#6366F1" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Score timeline will appear as changes are recorded
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Candidate Details */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Requisition Title", value: candidate.reqTitle },
                    { label: "Offer Role", value: candidate.offerRoleTitle },
                    { label: "Location", value: [candidate.offerLocation, candidate.offerCity].filter(Boolean).join(", ") || null },
                    { label: "Sector", value: candidate.sector },
                    { label: "Portfolio", value: candidate.portfolio },
                    { label: "Customer", value: candidate.customer || candidate.actualCustomer },
                    { label: "Department", value: candidate.department },
                    { label: "Experience", value: candidate.experience },
                    { label: "PRF Grade", value: candidate.prfGrade },
                    { label: "Ageing Bucket", value: candidate.ageingBucket },
                    { label: "Source", value: candidate.candidateSource },
                    { label: "Customer (Actual)", value: candidate.actualCustomer },
                    { label: "Skill", value: candidate.offeredSkill },
                    { label: "Level", value: candidate.offeredLevel },
                    { label: "Classification", value: candidate.employeeClassification },
                    { label: "Offer Date", value: formatDate(candidate.offerExtendedDate) },
                    { label: "Joining Month", value: candidate.joiningMonth },
                    { label: "Hiring Manager", value: candidate.hiringManagerEmail },
                    { label: "Recruiter", value: candidate.recruiter?.name },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-medium text-gray-900">{value || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Update Status */}
              {canEdit && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Update Status</h3>
                    {saving && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
                  </div>

                  <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
                    {/* Toggles */}
                    <div className="space-y-2.5">
                      {(
                        [
                          { label: "Resignation proof received", field: "resignationReceived", value: candidate.resignationReceived, at: candidate.resignationReceivedAt, danger: false },
                          { label: "KYC completed", field: "kycCompleted", value: candidate.kycCompleted, at: candidate.kycCompletedAt, danger: false },
                          { label: "LWD confirmed", field: "lwdConfirmed", value: candidate.lwdConfirmed, at: candidate.lwdConfirmedAt, danger: false },
                          { label: "Counter offer received", field: "counterOfferReceived", value: candidate.counterOfferReceived, at: null, danger: true },
                          { label: "Active on job portal", field: "activeOnJobPortal", value: candidate.activeOnJobPortal, at: null, danger: true },
                        ] as const
                      ).map((t) => (
                        <div key={t.field} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700">{t.label}</p>
                            {t.at && (
                              <p className="text-[10px] text-gray-400">{formatDate(t.at)}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={t.value}
                            onClick={() => patch({ [t.field]: !t.value })}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                              t.value
                                ? t.danger ? "bg-red-500" : "bg-green-500"
                                : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                                t.value ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Connects */}
                    {(
                      [
                        { label: "Connect 1", field: "preJoiningConnect1", value: candidate.preJoiningConnect1, due: getConnect1DueDate(new Date(candidate.offerExtendedDate), new Date(candidate.expectedDOJ)) },
                        { label: "Connect 2", field: "preJoiningConnect2", value: candidate.preJoiningConnect2, due: getConnect2DueDate(new Date(candidate.offerExtendedDate), new Date(candidate.expectedDOJ)) },
                      ] as const
                    ).map((c) => (
                      <div key={c.field}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-700">{c.label}</p>
                          <p className="text-[10px] text-gray-400">due {formatDate(c.due)}</p>
                        </div>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                          {(
                            [
                              { v: "PENDING", label: "Pending" },
                              { v: "COMPLETED", label: "Done" },
                              { v: "NOT_REACHABLE", label: "Unreachable" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => patch({ [c.field]: opt.v })}
                              className={`flex-1 px-1 py-1.5 text-[10px] font-medium transition-colors ${
                                (c.value ?? "PENDING") === opt.v
                                  ? opt.v === "COMPLETED"
                                    ? "bg-green-500 text-white"
                                    : opt.v === "NOT_REACHABLE"
                                    ? "bg-red-500 text-white"
                                    : "bg-gray-500 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Status */}
                    <div>
                      <p className="text-xs text-gray-700 mb-1">Candidate status</p>
                      <select
                        value={candidate.currentStatus}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "JOINED" || v === "DROPPED") {
                            if (!window.confirm(`Mark ${candidate.candidateName} as ${v}? Alerts will be closed.`)) {
                              e.target.value = candidate.currentStatus;
                              return;
                            }
                          }
                          patch({ currentStatus: v });
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="OFFERED">Offered</option>
                        <option value="OFFER_PENDING">Offer Pending</option>
                        <option value="JOINED">Joined</option>
                        <option value="DROPPED">Dropped</option>
                        <option value="ON_HOLD">On Hold</option>
                        <option value="NOT_IN_SNAPSHOT">Not in snapshot</option>
                      </select>
                    </div>

                    {/* Recruiter */}
                    <div>
                      <p className="text-xs text-gray-700 mb-1">Recruiter</p>
                      <select
                        value={candidate.recruiterId ?? ""}
                        onChange={(e) => patch({ recruiterId: e.target.value || null })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="">Unassigned</option>
                        {recruiters.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </fieldset>

                  {patchError && <p className="text-xs text-red-600 mt-3">{patchError}</p>}
                  <p className="text-[10px] text-gray-400 mt-3">
                    Changes recompute the RAG score instantly and are audit-logged.
                  </p>
                </div>
              )}

              {/* Remarks */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
                  {canEdit && (
                    <button
                      onClick={openRemarkEdit}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Edit Notes
                    </button>
                  )}
                </div>
                {candidate.recruiterRemarks && (
                  <div className="mb-3">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Recruiter Remarks
                    </div>
                    <p className="text-xs text-gray-700">{candidate.recruiterRemarks}</p>
                  </div>
                )}
                {candidate.candidateDemands && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Candidate Demands
                    </div>
                    <p className="text-xs text-gray-700">{candidate.candidateDemands}</p>
                  </div>
                )}
                {!candidate.recruiterRemarks && !candidate.candidateDemands && (
                  <p className="text-xs text-gray-400 italic">No notes added yet</p>
                )}
              </div>

              {/* Documents Upload */}
              {canEdit && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Documents</h3>
                  <div className="space-y-4">
                    <FileUpload
                      candidateId={candidate.id}
                      fileType="resignationProof"
                      currentFile={candidate.resignationProofFile}
                      onUploadSuccess={(filePath) => {
                        setCandidate(prev => prev ? { ...prev, resignationProofFile: filePath } : null);
                        fetchCandidate(); // Refresh data
                      }}
                      onFileDelete={() => {
                        setCandidate(prev => prev ? { ...prev, resignationProofFile: null } : null);
                        fetchCandidate(); // Refresh data
                      }}
                    />
                    <FileUpload
                      candidateId={candidate.id}
                      fileType="kycDocuments"
                      currentFile={candidate.kycDocumentsFile}
                      onUploadSuccess={(filePath) => {
                        setCandidate(prev => prev ? { ...prev, kycDocumentsFile: filePath } : null);
                        fetchCandidate(); // Refresh data
                      }}
                      onFileDelete={() => {
                        setCandidate(prev => prev ? { ...prev, kycDocumentsFile: null } : null);
                        fetchCandidate(); // Refresh data
                      }}
                    />
                    <FileUpload
                      candidateId={candidate.id}
                      fileType="resume"
                      currentFile={candidate.resumeFile}
                      onUploadSuccess={(filePath) => {
                        setCandidate(prev => prev ? { ...prev, resumeFile: filePath } : null);
                        fetchCandidate(); // Refresh data
                      }}
                      onFileDelete={() => {
                        setCandidate(prev => prev ? { ...prev, resumeFile: null } : null);
                        fetchCandidate(); // Refresh data
                      }}
                    />
                    <FileUpload
                      candidateId={candidate.id}
                      fileType="general"
                      currentFile={null}
                      onUploadSuccess={(filePath) => {
                        fetchCandidate(); // Refresh data
                      }}
                      onFileDelete={() => {
                        fetchCandidate(); // Refresh data
                      }}
                    />
                  </div>
                </div>
              )}

              {/* RAG Transitions */}
              {candidate.ragTransitions.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">RAG Transitions</h3>
                  <div className="space-y-2">
                    {candidate.ragTransitions.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: RAG_COLORS[t.fromColor] }}
                        />
                        <span className="text-gray-400">→</span>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: RAG_COLORS[t.toColor] }}
                        />
                        <span className="text-gray-500">
                          {formatDate(t.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score History Section */}
        {activeSection === "history" && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 animate-fade-in">
            {candidate.scoreHistory.map((sh) => (
              <div key={sh.id} className="p-4 flex items-start gap-4">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    sh.impact > 0 ? "bg-green-100" : sh.impact < 0 ? "bg-red-100" : "bg-gray-100"
                  }`}
                >
                  {sh.impact > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{sh.parameter}</span>
                    <span
                      className={`text-xs font-bold ${
                        sh.impact > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {sh.impact > 0 ? "+" : ""}
                      {Math.round(sh.impact)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{sh.reason}</p>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {Math.round(sh.oldScore)}% → {Math.round(sh.newScore)}% |{" "}
                    {new Date(sh.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {candidate.scoreHistory.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No score changes recorded yet</div>
            )}
          </div>
        )}

        {/* Interactions Section */}
        {activeSection === "interactions" && (
          <div className="space-y-4 animate-fade-in">
            {canEdit && (
              <button
                onClick={() => setShowInteractionForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Log New Interaction
              </button>
            )}

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {candidate.interactions.map((interaction) => (
                <div key={interaction.id} className="p-4 flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      interaction.type === "CALL"
                        ? "bg-blue-100"
                        : interaction.type === "EMAIL"
                        ? "bg-purple-100"
                        : interaction.type === "MEETING"
                        ? "bg-green-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {interaction.type === "CALL" ? (
                      <Phone className="w-4 h-4 text-blue-600" />
                    ) : interaction.type === "EMAIL" ? (
                      <Mail className="w-4 h-4 text-purple-600" />
                    ) : interaction.type === "MEETING" ? (
                      <User className="w-4 h-4 text-green-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {interaction.summary}
                      </span>
                      {interaction.sentiment && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            interaction.sentiment === "POSITIVE"
                              ? "bg-green-100 text-green-700"
                              : interaction.sentiment === "NEGATIVE"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {interaction.sentiment}
                        </span>
                      )}
                    </div>
                    {interaction.details && (
                      <p className="text-xs text-gray-600 mt-1">{interaction.details}</p>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1.5">
                      {interaction.user.name} | {interaction.type} |{" "}
                      {new Date(interaction.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {candidate.interactions.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No interactions recorded yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {activeSection === "alerts" && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 animate-fade-in">
            {candidate.alerts.map((alert) => (
              <div key={alert.id} className="p-4 flex items-start gap-3">
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    alert.priority === "CRITICAL"
                      ? "bg-red-500"
                      : alert.priority === "HIGH"
                      ? "bg-orange-500"
                      : alert.priority === "MEDIUM"
                      ? "bg-yellow-500"
                      : "bg-gray-400"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        alert.status === "OPEN"
                          ? "bg-yellow-100 text-yellow-700"
                          : alert.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Due: {new Date(alert.dueDate).toLocaleDateString()} | {alert.priority}
                  </div>
                </div>
              </div>
            ))}
            {candidate.alerts.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No alerts for this candidate</div>
            )}
          </div>
        )}
      </div>

      {/* Interaction Form Modal */}
      {showInteractionForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Log Interaction</h3>
              <button onClick={() => setShowInteractionForm(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-700 block mb-1">Type</label>
                <select
                  value={interactionForm.type}
                  onChange={(e) => setInteractionForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="CALL">Phone Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">Meeting</option>
                  <option value="NOTE">Note</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Summary</label>
                <input
                  type="text"
                  value={interactionForm.summary}
                  onChange={(e) => setInteractionForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Brief summary..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Details</label>
                <textarea
                  value={interactionForm.details}
                  onChange={(e) => setInteractionForm((f) => ({ ...f, details: e.target.value }))}
                  rows={3}
                  placeholder="Detailed notes..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowInteractionForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddInteraction}
                disabled={!interactionForm.summary}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remark Edit Modal */}
      {showRemarkEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Candidate Notes</h3>
              <button onClick={() => setShowRemarkEdit(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-700 block mb-1">Recruiter Remarks</label>
                <textarea
                  value={remarkForm.recruiterRemarks}
                  onChange={(e) => setRemarkForm((f) => ({ ...f, recruiterRemarks: e.target.value }))}
                  rows={4}
                  placeholder="Add your remarks about this candidate..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Candidate Demands</label>
                <textarea
                  value={remarkForm.candidateDemands}
                  onChange={(e) => setRemarkForm((f) => ({ ...f, candidateDemands: e.target.value }))}
                  rows={3}
                  placeholder="Any specific demands or requirements from the candidate..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Reason for Change (Optional)</label>
                <input
                  type="text"
                  value={remarkForm.reason}
                  onChange={(e) => setRemarkForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Why are you updating these notes?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                <strong>Note:</strong> All changes will be tracked with your name and timestamp for audit purposes.
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowRemarkEdit(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditRemarks}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
