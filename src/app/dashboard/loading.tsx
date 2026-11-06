export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-200" />
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-gray-200" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-xl border border-gray-200" />
      </div>
    </div>
  );
}
