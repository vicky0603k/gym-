/**
 * Member home — membership card, weekly goal placeholder, quick actions.
 * Module 1 shell; real data wired in Module 2 (profile) and Module 4 (streak).
 */
export default function MemberHomePage() {
  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">My Gym</h1>

      {/* Membership card (placeholder) */}
      <div className="card p-5 mb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="text-lg font-semibold text-foreground">Half-yearly</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
            Active
          </span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-sm text-muted">Expires on</p>
          <p className="text-foreground font-medium">—</p>
        </div>
      </div>

      {/* Weekly goal (placeholder) */}
      <div className="card p-5 mb-4">
        <p className="text-sm text-muted mb-2">This week&apos;s goal</p>
        <div className="flex items-end gap-2 mb-3">
          <span className="kpi-number">0</span>
          <span className="text-muted text-lg pb-1">/ 4 visits</span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden">
          <div className="bg-accent h-full rounded-full" style={{ width: "0%" }} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/member/check-in" className="btn-primary text-sm text-center">
          📳 Check in
        </a>
        <a href="/member/renew" className="btn-secondary text-sm text-center">
          💳 Renew
        </a>
      </div>
    </div>
  );
}
