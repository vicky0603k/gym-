import Link from "next/link";
import { Bell, ChevronRight, History, ReceiptIndianRupee } from "lucide-react";

export const metadata = { title: "More" };

const LINKS = [
  { href: "/member/attendance", label: "My visits", hint: "Every check-in, newest first", icon: History },
  { href: "/member/payments", label: "Payments and receipts", hint: "Renewals and add-ons", icon: ReceiptIndianRupee },
  { href: "/member/settings", label: "Message settings", hint: "Reminders and offers", icon: Bell },
];

export default function MemberMorePage() {
  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-4">More</h1>
      <ul className="card divide-y divide-border">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2">
              <l.icon className="h-5 w-5 text-muted" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium text-foreground">{l.label}</span>
                <span className="block text-sm text-muted">{l.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
