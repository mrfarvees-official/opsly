import Link from "next/link";

const stats = [
  { label: "Open tasks", value: "24", note: "6 due this week" },
  { label: "Waiting on you", value: "3", note: "Oldest: 2 days" },
  { label: "Done this month", value: "87", note: "12 more than last month" },
];

const tasks = [
  {
    name: "Approve Q4 vendor contract",
    owner: "Maya R.",
    due: "Today",
    state: "Needs you",
  },
  {
    name: "Onboard Brightline Logistics",
    owner: "Dev T.",
    due: "Fri",
    state: "In progress",
  },
  {
    name: "Renew warehouse insurance",
    owner: "Sam O.",
    due: "Oct 16",
    state: "In progress",
  },
  {
    name: "Reconcile September invoices",
    owner: "Lena K.",
    due: "Done",
    state: "Done",
  },
];

const badge: Record<string, string> = {
  "Needs you": "bg-warn-tint text-warn",
  "In progress": "bg-brand-tint text-brand-dark",
  Done: "bg-ok-tint text-ok",
};

export default function DashboardPage() {
  return (
    <main className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Overview
          </h1>
          <p className="mt-1 text-ink-soft">
            Sample data. Connect your workspace to see real tasks.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          New task
        </Link>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-line bg-card p-5"
          >
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-display text-4xl font-bold">{s.value}</dd>
            <p className="mt-1 text-sm text-ink-soft">{s.note}</p>
          </div>
        ))}
      </dl>

      <section
        className="mt-8 rounded-xl border border-line bg-card"
        aria-labelledby="tasks-h"
      >
        <h2
          id="tasks-h"
          className="border-b border-line px-5 py-4 font-display text-lg font-semibold"
        >
          Tasks that need attention
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => (
                <tr key={t.name}>
                  <td className="px-5 py-3.5 font-medium">{t.name}</td>
                  <td className="px-5 py-3.5 text-ink-soft">{t.owner}</td>
                  <td className="px-5 py-3.5 text-ink-soft">{t.due}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[t.state]}`}
                    >
                      {t.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
