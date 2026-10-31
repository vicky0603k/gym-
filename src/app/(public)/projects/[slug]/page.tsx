import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, PROJECTS } from "@/data/projects";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Page, PageHeader, Section } from "@/components/ui/page";

export const dynamicParams = false;
export const generateStaticParams = () => PROJECTS.map((p) => ({ slug: p.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: getProject(params.slug)?.title ?? "Project" };
}

/** One project's detail page: showcase image, summary, features, how it works and its figures. */
export default function ProjectPage({ params }: { params: { slug: string } }) {
  const p = getProject(params.slug);
  if (!p) notFound();

  return (
    <Page width="wide" className="py-10">
      <PageHeader back={{ href: "/projects", label: "Projects" }} kicker={p.tagline} title={p.title} description={p.summary} />
      <div className="mb-4 flex flex-wrap gap-1">
        {p.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- next/image is off in this app (next.config.mjs) */}
      <img src={p.image} alt={`${p.title} showcase`} className={p.portrait ? "mx-auto w-full max-w-md rounded-lg" : "w-full rounded-lg"} />

      {p.metrics && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {p.metrics.map((m) => (
            <Card key={m.label} pad="sm" className="text-center">
              <p className="num-display whitespace-nowrap text-2xl text-foreground sm:text-3xl">{m.value}</p>
              <p className="text-sm text-muted">{m.label}</p>
            </Card>
          ))}
        </div>
      )}

      <Section title="Features">
        <ul className="grid gap-3 sm:grid-cols-2">
          {p.features.map((f) => (
            <li key={f.title} className="card p-4">
              <p className="font-semibold text-foreground">{f.title}</p>
              {f.detail && <p className="text-sm text-muted">{f.detail}</p>}
            </li>
          ))}
        </ul>
      </Section>

      {p.steps && (
        <Section title="How it works">
          <ol className="space-y-2">
            {p.steps.map((s, i) => (
              <li key={s} className="card flex items-start gap-3 p-4">
                <span className="num-display text-2xl text-foreground">{i + 1}</span>
                <span className="text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </Page>
  );
}
