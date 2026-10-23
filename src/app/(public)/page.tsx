import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Dumbbell, MapPin, MessageCircle, Phone, Users } from "lucide-react";
import { getSettings } from "@/services/settings";
import { listPlans } from "@/services/memberships";
import { listActiveTrainers } from "@/services/members";
import { whatsAppLink } from "@/services/red-list";
import { applyDiscount, formatRupees } from "@/utils/money";
import { formatPhone } from "@/utils/phone";

// Prices, timings and trainers come from the database on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getSettings();
    const name = s.gym_name || "Gym";
    const description = s.tagline || [name, s.address].filter(Boolean).join(" · ");
    return { title: { absolute: name }, description, openGraph: { title: name, description, type: "website" } };
  } catch {
    return {};
  }
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function durationLabel(days: number) {
  if (days % 365 === 0) return days === 365 ? "12 months" : `${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? "1 month" : `${days / 30} months`;
  return `${days} days`;
}

/** Public gym website: hero, plans, trainers, timings, address, login entry. All content from Settings, Plans and Trainers. */
export default async function LandingPage() {
  const [s, plans, trainers] = await Promise.all([getSettings(), listPlans(), listActiveTrainers()]);
  const name = s.gym_name || "Our gym";
  const offered = plans.filter((p) => p.is_active);
  const join = s.phone ? whatsAppLink(s.phone, `Hi, I'd like to join ${name}. Please share the details.`) : null;
  const hours = s.opening_hours?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];

  return (
    <div className="min-h-screen">
      <section className="px-6 pt-16 pb-10">
        <div className="mx-auto max-w-3xl md:grid md:grid-cols-2 md:items-center md:gap-10">
          <div className="text-center md:text-left">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent md:mx-0" aria-hidden>
              <span className="text-2xl font-black text-accent-foreground">{name.trim()[0]?.toUpperCase()}</span>
            </div>
            <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">{name}</h1>
            {s.tagline && <p className="text-lg leading-relaxed text-muted">{s.tagline}</p>}
            {s.address && <p className="mt-2 text-sm text-muted">{s.address}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row md:justify-start">
              {join && (
                <a href={join} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center justify-center gap-2">
                  <MessageCircle className="h-5 w-5" aria-hidden /> Join — message us
                </a>
              )}
              <Link href="/login" className={join ? "btn-secondary" : "btn-primary"}>
                Member login
              </Link>
            </div>
          </div>
          {/* Designed panel in place of photos until the gym's own are added (docs/assets.md). */}
          <div className="mt-10 hidden aspect-square rounded-3xl border border-border bg-gradient-to-br from-accent/25 via-surface to-background p-8 md:mt-0 md:flex md:flex-col md:justify-between" aria-hidden>
            <Dumbbell className="h-16 w-16 text-accent" />
            <p className="text-2xl font-bold leading-snug text-foreground">Train consistently. Track every visit. Hit your weekly goal.</p>
          </div>
        </div>
      </section>

      <section className="px-6 py-8" aria-labelledby="plans-heading">
        <div className="mx-auto max-w-3xl">
          <h2 id="plans-heading" className="mb-4 text-xl font-bold text-foreground">Membership plans</h2>
          {offered.length === 0 ? (
            <p className="card p-4 text-muted">Ask us about current membership plans and prices.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {offered.map((p) => (
                <li key={p.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-sm text-muted">{durationLabel(p.duration_days)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums text-accent">{formatRupees(applyDiscount(p.price, p.discount_pct))}</p>
                      {p.discount_pct > 0 && (
                        <p className="text-xs text-muted">
                          <s>{formatRupees(p.price)}</s> · {p.discount_pct}% off
                        </p>
                      )}
                    </div>
                  </div>
                  {p.benefits && <p className="mt-3 text-sm text-muted">{p.benefits}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {trainers.length > 0 && (
        <section className="px-6 py-8" aria-labelledby="trainers-heading">
          <div className="mx-auto max-w-3xl">
            <h2 id="trainers-heading" className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
              <Users className="h-5 w-5 text-accent" aria-hidden /> Our trainers
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {trainers.map((t) => (
                <li key={t.id} className="card flex items-center gap-3 p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-foreground" aria-hidden>
                    {initials(t.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{t.name}</span>
                    {t.specialisation && <span className="block text-sm text-muted">{t.specialisation}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(hours.length > 0 || s.address || s.phone) && (
        <section className="px-6 py-8" aria-labelledby="visit-heading">
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            <h2 id="visit-heading" className="sr-only">Visit us</h2>
            {hours.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Clock className="h-5 w-5 text-accent" aria-hidden /> Timings
                </h3>
                <ul className="space-y-1 text-muted">
                  {hours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {(s.address || s.phone) && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <MapPin className="h-5 w-5 text-accent" aria-hidden /> Find us
                </h3>
                {s.address && <p className="text-muted">{s.address}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.maps_url && (
                    <a href={s.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" aria-hidden /> Open in Google Maps
                    </a>
                  )}
                  {s.phone && (
                    <a href={`tel:+91${s.phone}`} className="btn-secondary inline-flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" aria-hidden /> +91 {formatPhone(s.phone)}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="mt-8 border-t border-border px-6 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {name}
            {s.phone && ` · +91 ${formatPhone(s.phone)}`}
          </p>
          <p className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Member login
            </Link>
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && (
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`} className="hover:text-foreground">
                App support
              </a>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
