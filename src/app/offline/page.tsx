export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Placeholder logo */}
      <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mb-8">
        <span className="text-3xl font-black text-accent-foreground">G</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-3">
        You&apos;re offline
      </h1>
      <p className="text-muted text-base leading-relaxed max-w-xs">
        Your check-in could not be recorded. Please ask the front desk staff
        for an assisted check-in.
      </p>

      <div className="mt-8 p-4 bg-surface rounded-lg border border-border max-w-xs w-full">
        <p className="text-sm text-muted">
          All other features — your membership card, attendance history and
          renewal — will be available once you&apos;re back online.
        </p>
      </div>
    </div>
  );
}
