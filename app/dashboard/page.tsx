import Link from "next/link";

import { getDashboardNavigation } from "@/features/platform/application/dashboard-navigation";
import { listTeams } from "@/features/platform/application/team-service";
import { listUsers } from "@/features/platform/application/user-service";

export const instant = false;

export default async function DashboardPage() {
  const [teams, users, navigation] = await Promise.all([
    listTeams(),
    listUsers(),
    getDashboardNavigation(),
  ]);
  const canView = (resource: string) =>
    navigation.items.some((item) => item.resource === resource);

  const stats = [
    { label: "People", value: users.length, href: "/dashboard/users", note: "Members with workspace access" },
    { label: "Teams", value: teams.length, href: "/dashboard/teams", note: "Active operating groups" },
    { label: "Security", value: "Live", href: canView("pbac") ? "/dashboard/policies" : null, note: "PBAC checks every request" },
  ];

  return (
    <main className="p-6 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Workspace overview</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Good morning, let&apos;s keep things moving.</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">A clear view of your workspace, its people, and the access rules keeping everything in the right hands.</p>
        </div>
        <Link href="/dashboard/teams" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark">Open workspace</Link>
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href ?? "/dashboard"} aria-disabled={!stat.href} className={`group rounded-2xl border border-line bg-card p-5 transition ${stat.href ? "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_14px_35px_-24px_rgba(18,32,58,0.45)]" : "cursor-default"}`}>
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-ink-soft">{stat.label}</p><span className="text-brand transition group-hover:translate-x-1">→</span></div>
            <p className="mt-4 font-display text-4xl font-bold">{stat.value}</p>
            <p className="mt-1 text-sm text-ink-soft">{stat.note}</p>
          </Link>
        ))}
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-line bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Start here</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Your workspace control center</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">Use the sidebar to move between operational data and the policies that protect it. Navigation is filtered by PBAC permissions, and every page checks access again on the server.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/dashboard/users" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Review people</Link>{canView("pbac") && <Link href="/dashboard/policies" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:border-brand">Inspect policies</Link>}</div>
        </div>
        <div className="rounded-2xl border border-brand/20 bg-brand-tint p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-dark">Access model</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Private by default.</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">Each tenant has an isolated database. PBAC decides which resources appear here and authorizes every data request behind them.</p>
          {canView("audit") && <Link href="/dashboard/audit" className="mt-6 inline-flex text-sm font-semibold text-brand-dark underline decoration-brand/30 underline-offset-4 hover:decoration-brand">View the audit trail →</Link>}
        </div>
      </section>
    </main>
  );
}
