import Link from "next/link";

const GYM_NAME = process.env.NEXT_PUBLIC_GYM_NAME ?? "FitLife Gym";

/**
 * Public landing page — gym info, plans, trainers, timings, address, login entry.
 * Module 1 shell; full content in Module 8.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-12">
        <div className="max-w-md mx-auto text-center">
          {/* Placeholder logo */}
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-black text-accent-foreground">
              {GYM_NAME.charAt(0)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {GYM_NAME}
          </h1>
          <p className="text-muted text-lg leading-relaxed">
            Train smarter. Stay consistent. Achieve your weekly goals.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/login" className="btn-primary w-full">
              Login / Join
            </Link>
          </div>
        </div>
      </section>

      {/* Plans preview */}
      <section className="px-6 py-8">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-4">Our Plans</h2>
          <div className="space-y-3">
            {[
              { name: "Monthly", price: "₹1,000", duration: "30 days" },
              { name: "Quarterly", price: "₹2,500", duration: "90 days · 10% off" },
              { name: "Half-yearly", price: "₹4,500", duration: "180 days · 15% off" },
              { name: "Yearly", price: "₹8,000", duration: "365 days · 20% off" },
            ].map((plan) => (
              <div key={plan.name} className="card p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="text-sm text-muted">{plan.duration}</p>
                </div>
                <p className="text-lg font-bold text-accent">{plan.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timings */}
      <section className="px-6 py-8">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-4">Timings</h2>
          <div className="card p-4 space-y-2 text-muted">
            <div className="flex justify-between">
              <span>Morning</span>
              <span className="text-foreground">5:00 AM – 11:00 AM</span>
            </div>
            <div className="flex justify-between">
              <span>Evening</span>
              <span className="text-foreground">4:00 PM – 10:00 PM</span>
            </div>
          </div>
        </div>
      </section>

      {/* Address */}
      <section className="px-6 py-8 pb-20">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-4">Find Us</h2>
          <div className="card p-4 text-muted">
            <p className="text-foreground mb-1">12 MG Road, Indiranagar</p>
            <p>Bengaluru, KA 560038</p>
            <p className="mt-2 text-foreground">📞 +91 90000 00000</p>
          </div>
        </div>
      </section>
    </div>
  );
}
