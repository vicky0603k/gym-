import type { Metadata } from "next";
import Link from "next/link";
import { PROJECTS } from "@/data/projects";
import { Badge } from "@/components/ui/badge";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Projects" };

/** Showcase of projects that have no website of their own; each opens its detail page. */
export default function ProjectsPage() {
  return (
    <Page width="wide" className="py-10">
      <PageHeader title="Projects" description="Projects without a website of their own — open one for its details." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {PROJECTS.map((p) => (
          <li key={p.slug}>
            <Link href={`/projects/${p.slug}`} className="card block h-full overflow-hidden hover:border-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image is off in this app (next.config.mjs) */}
              <img src={p.image} alt="" loading="lazy" className="aspect-video w-full bg-foreground object-cover object-top" />
              <div className="space-y-2 p-4">
                <h2 className="text-lg font-semibold text-foreground">{p.title}</h2>
                <p className="text-sm text-muted">{p.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <Badge key={t} size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
