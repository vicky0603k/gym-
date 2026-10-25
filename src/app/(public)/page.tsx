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
  const cheapest = [...offered].sort((a, b) => a.duration_days - b.duration_days)[0];

  return (
    <div className="min-h-screen">
      <section className="bg-foreground px-4 pb-12 pt-14 text-background">
        <div className="mx-auto max-w-3xl md:grid md:grid-cols-[1.4fr_1fr] md:items-end md:gap-10">
          <div>
            <h1 className="num-display break-words text-6xl uppercase md:text-7xl">{name}</h1>
            {s.tagline && <p className="mt-4 text-lg leading-relaxed text-background/80">{s.tagline}</p>}
            {s.address && (
              <p className="mt-3 flex items-start gap-2 text-sm text-background/70">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {s.address}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {join && (
                <a href={join} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  <MessageCircle className="h-5 w-5" aria-hidden /> Join — message us
                </a>
              )}
              <Link
                href="/login"
                className={join ? "btn-secondary border-background/40 bg-transparent text-background hover:bg-background/10" : "btn-primary"}
              >
                Member login
              </Link>
            </div>
          </div>
          {/* Until the gym's own photos arrive (docs/assets.md): the real starting price, card-style. */}
          {cheapest && (
            <div className="mt-10 rounded-lg border border-background/20 p-5 md:mt-0">
              <Dumbbell className="h-7 w-7 text-accent" aria-hidden />
              <p className="mt-4 text-sm text-background/70">Memberships from</p>
              <p className="num-display text-5xl text-accent">{formatRupees(applyDiscount(cheapest.price, cheapest.discount_pct))}</p>
              <p className="mt-1 text-sm text-background/70">
                {cheapest.name} · {durationLabel(cheapest.duration_days)}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-8 pt-10" aria-labelledby="plans-heading">
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
                      <p className="num-display text-3xl text-foreground">{formatRupees(applyDiscount(p.price, p.discount_pct))}</p>
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
        <section className="px-4 py-8" aria-labelledby="trainers-heading">
          <div className="mx-auto max-w-3xl">
            <h2 id="trainers-heading" className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
              <Users className="h-5 w-5" aria-hidden /> Our trainers
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
        <section className="px-4 py-8" aria-labelledby="visit-heading">
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            <h2 id="visit-heading" className="sr-only">Visit us</h2>
            {hours.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Clock className="h-5 w-5" aria-hidden /> Timings
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
                  <MapPin className="h-5 w-5" aria-hidden /> Find us
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

      <footer className="mt-8 border-t border-border px-4 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {name}
            {s.phone && ` · +91 ${formatPhone(s.phone)}`}
          </p>
          <p className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Member login
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
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
