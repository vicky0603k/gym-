import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSettings } from "@/services/settings";
import { formatPhone } from "@/utils/phone";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-muted leading-relaxed">{children}</div>
    </section>
  );
}

/** Privacy notice (C9): what the gym's app collects and why, in line with India's DPDP Act, 2023. */
export default async function PrivacyPage() {
  const s = await getSettings();
  const gym = s.gym_name || "The gym";
  const contact = [s.phone && `+91 ${formatPhone(s.phone)}`, s.address].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <Link href="/" className="inline-flex min-h-[48px] items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {gym}
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-foreground">Privacy notice</h1>
        <p className="mt-2 text-muted">How {gym} uses your information in its member app.</p>
      </div>

      <Section title="What we collect">
        <p>Your name, mobile number and a 4-digit login PIN (stored only in scrambled form — nobody at the gym can read it).</p>
        <p>Your membership: plan, start and expiry dates, pauses, and payments you make (amount, date and the UPI reference or cash receipt number). We never collect card numbers, UPI PINs or bank passwords.</p>
        <p>Your visits: the date and time each time you check in at the gate.</p>
      </Section>

      <Section title="Why we use it">
        <p>To let you check in, show your weekly visit goal, keep your membership and receipts in one place, and confirm your payments.</p>
        <p>If you stop visiting for a while, staff may call or WhatsApp you to check on you. Staff also message you before your membership expires. You can turn both off in the app under More → Settings.</p>
        <p>Offers and promotions are sent only if you agree to them, and you can switch them off at any time in the same place.</p>
      </Section>

      <Section title="Who can see it">
        <p>Only the gym&apos;s owner and front-desk staff, who log in with their own accounts. Every change they make — payments, pauses, PIN resets — is recorded with their name.</p>
        <p>Your information is stored with our hosting provider (Supabase) and is not sold or shared with advertisers.</p>
      </Section>

      <Section title="How long we keep it">
        <p>While you are a member, and afterwards for as long as the law requires us to keep payment records.</p>
      </Section>

      <Section title="Your choices">
        <p>You can ask the front desk to see the details we hold about you, correct them, or remove your personal details after you leave the gym. Payment and visit records are kept without your name for the gym&apos;s accounts.</p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or requests: speak to the front desk or contact {gym}
          {contact ? ` — ${contact}` : ""}.
        </p>
      </Section>
    </main>
  );
}
