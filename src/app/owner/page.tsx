/**
 * Owner dashboard — KPI cards + today's action lists.
 * Module 1 shell; real KPI queries wired in Module 8.
 */
export default function OwnerDashboardPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {/* KPI grid (placeholder) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Members", value: "—" },
          { label: "Today's Check-ins", value: "—" },
          { label: "Open Red List", value: "—" },
          { label: "Renewals Due (7d)", value: "—" },
          { label: "Collection (Month)", value: "₹—" },
          { label: "Add-on Revenue", value: "₹—" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-muted mb-1">{kpi.label}</p>
            <p className="kpi-number">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Action lists placeholder */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Today&apos;s Actions
        </h2>
        <p className="text-muted text-sm">
          Dashboard KPIs and action lists will be wired to live data in Module 8.
        </p>
      </div>
    </div>
  );
}
