"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import {
  Users, TrendingUp, AlertTriangle, Calendar, Search, Download,
  Upload, Bell, BrainCircuit, History, LayoutGrid, RefreshCw,
  ChevronRight, CheckCircle2,
} from "lucide-react";
import Header from "@/components/header";
import ExcelImport from "@/components/excel-import";
import type { UserSession, AIInsight } from "@/types";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { exportToCsv } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

const RAG_COLORS: Record<string, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GREY: "#9ca3af",
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-600",
};

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "insights", label: "AI Insights", icon: BrainCircuit },
  { id: "audit", label: "Audit Trail", icon: History },
  { id: "import", label: "Import", icon: Upload },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardPage() {
  const router = useRouter();
  const { data: authSession, status } = useSession();
  const [tab, setTab] = useState<TabId>("overview");

  const [stats, setStats] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [ragFilter, setRagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [myAlertsOnly, setMyAlertsOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const user = authSession?.user as unknown as UserSession | undefined;
  const canEdit = ["TA_SPECIALIST", "ADMIN"].includes(user?.role ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/rag/compute", { method: "POST" });
      const [s, c, a, i, au] = await Promise.all([
        fetch("/api/dashboard/stats").then((r) => r.json()),
        fetch("/api/candidates?limit=200").then((r) => r.json()),
        fetch("/api/alerts?status=OPEN").then((r) => r.json()),
        fetch("/api/ai/insights").then((r) => r.json()),
        fetch("/api/audit?limit=50").then((r) => r.json()),
      ]);
      setStats(s);
      setCandidates(c.candidates ?? []);
      setAlerts(Array.isArray(a) ? a : []);
      setInsights(Array.isArray(i) ? i : i.insights ?? []);
      setAudits(Array.isArray(au) ? au : au.logs ?? au.auditLogs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchAll();
    if (status === "unauthenticated") router.push("/");
  }, [status, fetchAll, router]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (ragFilter && c.ragColor !== ragFilter) return false;
      if (statusFilter && c.currentStatus !== statusFilter) return false;
      if (mineOnly && c.recruiter?.id !== user?.id) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.candidateName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.reqNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [candidates, search, ragFilter, statusFilter, mineOnly, user?.id]);

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (!priorityFilter || a.priority === priorityFilter) &&
          (!myAlertsOnly || a.assignedTo?.id === user?.id)
      ),
    [alerts, priorityFilter, myAlertsOnly, user?.id]
  );

  const alertsByCandidate = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const a of filteredAlerts) {
      const list = groups.get(a.candidateId) ?? [];
      list.push(a);
      groups.set(a.candidateId, list);
    }
    return Array.from(groups.entries());
  }, [filteredAlerts]);

  const pieData = stats
    ? [
        { name: "Green", value: stats.greenCount, color: RAG_COLORS.GREEN },
        { name: "Amber", value: stats.amberCount, color: RAG_COLORS.AMBER },
        { name: "Red", value: stats.redCount, color: RAG_COLORS.RED },
        { name: "Grey", value: stats.greyCount, color: RAG_COLORS.GREY },
      ].filter((d) => d.value > 0)
    : [];

  const sectorData = stats
    ? Object.entries(stats.bySector ?? {}).map(([name, v]: [string, any]) => ({
        name: name.length > 22 ? name.slice(0, 22) + "…" : name,
        Green: v.green, Amber: v.amber, Red: v.red,
      }))
    : [];

  const topRisks = useMemo(
    () => candidates.filter((c) => c.ragColor === "RED").slice(0, 5),
    [candidates]
  );

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header session={user} />

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.filter(({ id }) => id !== "import" || canEdit).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  tab === id
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {id === "alerts" && alerts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                    {alerts.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            {tab === "overview" && stats && (
              <div className="space-y-6">
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={Users} label="Offered Candidates" value={stats.totalCandidates} />
                  <KpiCard icon={Calendar} label="Joining This Month" value={stats.joiningThisMonth} />
                  <KpiCard icon={Bell} label="Open Alerts" value={stats.pendingAlerts} accent="amber" />
                  <KpiCard icon={TrendingUp} label="Dropped This Month" value={stats.droppedThisMonth} accent="red" />
                  {stats.notInSnapshotCount > 0 && (
                    <KpiCard icon={AlertTriangle} label="Not in snapshot" value={stats.notInSnapshotCount} accent="red" />
                  )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* RAG distribution */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">RAG Distribution</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                          {pieData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Trend */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">7-Day Trend</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={stats.trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="green" stroke={RAG_COLORS.GREEN} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="amber" stroke={RAG_COLORS.AMBER} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="red" stroke={RAG_COLORS.RED} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top risks */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Risks</h3>
                    {topRisks.length === 0 ? (
                      <p className="text-sm text-gray-400">No red-status candidates.</p>
                    ) : (
                      <ul className="space-y-2">
                        {topRisks.map((c) => (
                          <li key={c.id}>
                            <button
                              onClick={() => router.push(`/candidates/${c.id}`)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-left"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{c.candidateName}</p>
                                <p className="text-xs text-gray-500">DOJ {formatDate(c.expectedDOJ)}</p>
                              </div>
                              <span className="text-sm font-semibold text-red-600">{Math.round(c.ragScore)}%</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Sector breakdown */}
                {sectorData.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Candidates by Sector</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={sectorData} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Green" stackId="a" fill={RAG_COLORS.GREEN} />
                        <Bar dataKey="Amber" stackId="a" fill={RAG_COLORS.AMBER} />
                        <Bar dataKey="Red" stackId="a" fill={RAG_COLORS.RED} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {tab === "candidates" && (
              <div className="space-y-4">
                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email, req no…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <select
                    value={ragFilter}
                    onChange={(e) => setRagFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">All statuses</option>
                    <option value="RED">Red</option>
                    <option value="AMBER">Amber</option>
                    <option value="GREEN">Green</option>
                    <option value="GREY">Grey</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">All candidate statuses</option>
                    <option value="OFFERED">Offered</option>
                    <option value="OFFER_PENDING">Offer pending</option>
                    <option value="JOINED">Joined</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="ON_HOLD">On hold</option>
                    <option value="NOT_IN_SNAPSHOT">Not in snapshot</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mineOnly}
                      onChange={(e) => setMineOnly(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    My candidates only
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() =>
                        exportToCsv(
                          "candidates.csv",
                          filteredCandidates.map((c) => ({
                            ReqNo: c.reqNumber, Name: c.candidateName, Email: c.email,
                            Status: c.currentStatus, RAG: c.ragColor, Score: c.ragScore,
                            DOJ: formatDate(c.expectedDOJ), Sector: c.sector,
                            Recruiter: c.recruiter?.name,
                          }))
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <button
                      onClick={fetchAll}
                      className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/60">
                          <th className="px-4 py-3 font-medium">Candidate</th>
                          <th className="px-4 py-3 font-medium">Req No</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">RAG</th>
                          <th className="px-4 py-3 font-medium">Score</th>
                          <th className="px-4 py-3 font-medium">Expected DOJ</th>
                          <th className="px-4 py-3 font-medium">Sector</th>
                          <th className="px-4 py-3 font-medium">Recruiter</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredCandidates.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => router.push(`/candidates/${c.id}`)}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{c.candidateName}</p>
                              <p className="text-xs text-gray-500">{c.email}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{c.reqNumber}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "px-2 py-0.5 text-xs rounded-full",
                                c.currentStatus === "NOT_IN_SNAPSHOT"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {c.currentStatus === "NOT_IN_SNAPSHOT" ? "Not in snapshot" : c.currentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ backgroundColor: RAG_COLORS[c.ragColor] }}
                                title={c.ragColor}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">{Math.round(c.ragScore)}%</td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(c.expectedDOJ)}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{c.sector ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{c.recruiter?.name ?? "—"}</td>
                            <td className="px-4 py-3">
                              <ChevronRight className="w-4 h-4 text-gray-300" />
                            </td>
                          </tr>
                        ))}
                        {filteredCandidates.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                              No candidates match your filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "alerts" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">All priorities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={myAlertsOnly}
                      onChange={(e) => setMyAlertsOnly(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    My alerts only
                  </label>
                  <span className="ml-auto text-xs text-gray-500">
                    {filteredAlerts.length} alerts across {alertsByCandidate.length} candidates
                  </span>
                </div>
                {alertsByCandidate.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                    No open alerts.
                  </div>
                )}
                {alertsByCandidate.map(([candidateId, group]) => (
                  <div key={candidateId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => router.push(`/candidates/${candidateId}`)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100 hover:bg-gray-100/60 text-left"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: RAG_COLORS[group[0].candidate?.ragColor] ?? RAG_COLORS.GREY }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {group[0].candidate?.candidateName ?? "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400">
                        DOJ {formatDate(group[0].candidate?.expectedDOJ)} · {group.length} alert{group.length === 1 ? "" : "s"}
                      </span>
                    </button>
                    <div className="divide-y divide-gray-100">
                      {group.map((a: any) => (
                        <div key={a.id} className="px-4 py-3 flex items-start gap-4">
                          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900">{a.title}</p>
                              <span className={cn("px-2 py-0.5 text-xs rounded-full", PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.MEDIUM)}>
                                {a.priority}
                              </span>
                            </div>
                            {a.description && <p className="text-xs text-gray-500 mt-1">{a.description}</p>}
                            <p className="text-xs text-gray-400 mt-1">
                              Due {formatDate(a.dueDate)} · {a.assignedTo?.name}
                            </p>
                          </div>
                          {canEdit && (
                          <button
                            onClick={async () => {
                              await fetch("/api/alerts", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ alertId: a.id, status: "COMPLETED", userId: user.id }),
                              });
                              fetchAll();
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "insights" && (
              <div className="grid md:grid-cols-2 gap-4">
                {insights.length === 0 && (
                  <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                    No insights generated yet.
                  </div>
                )}
                {insights.map((i) => (
                  <div key={i.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs rounded-full font-medium",
                          i.severity === "HIGH" && "bg-red-100 text-red-700",
                          i.severity === "MEDIUM" && "bg-amber-100 text-amber-700",
                          i.severity === "LOW" && "bg-gray-100 text-gray-600"
                        )}
                      >
                        {i.severity}
                      </span>
                      <span className="text-xs text-gray-400">{i.type}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {Math.round(i.confidence * 100)}% confidence
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">{i.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{i.description}</p>
                    {i.suggestedAction && (
                      <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mt-3">
                        {i.suggestedAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "audit" && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {audits.length === 0 && (
                  <p className="p-10 text-center text-sm text-gray-400">No audit entries yet.</p>
                )}
                {audits.map((l: any) => (
                  <div key={l.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <History className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-800">{l.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {l.user?.name ?? "System"} · {l.entityType} · {formatDateTime(l.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "import" && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
                <ExcelImport onImportSuccess={fetchAll} />
                <p className="text-xs text-gray-400 mt-4">
                  Uploads the daily "Candidate Report" workbook as-is. New candidates are added,
                  changed rows update in place with an audit trail, and unchanged rows are skipped.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent?: "amber" | "red";
}) {
  const color =
    accent === "red" ? "text-red-600 bg-red-50" : accent === "amber" ? "text-amber-600 bg-amber-50" : "text-brand-600 bg-brand-50";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
