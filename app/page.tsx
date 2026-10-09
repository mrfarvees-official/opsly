import Link from "next/link";
import { Logo } from "@/components/logo";

const rows = [
  {
    name: "Approve Q4 vendor contract",
    who: "Maya R.",
    state: "Needs you",
    tone: "warn",
  },
  {
    name: "Onboard Brightline Logistics",
    who: "Dev T.",
    state: "In progress",
    tone: "brand",
  },
  {
    name: "Reconcile September invoices",
    who: "Lena K.",
    state: "Done",
    tone: "ok",
  },
  {
    name: "Renew warehouse insurance",
    who: "Sam O.",
    state: "In progress",
    tone: "brand",
  },
] as const;

const tones = {
  warn: "bg-warn-tint text-warn",
  brand: "bg-brand-tint text-brand-dark",
  ok: "bg-ok-tint text-ok",
};

const features = [
  {
    title: "A private workspace for every team",
    body: "Each company gets its own isolated database. Your data is never mixed with anyone else's.",
  },
  {
    title: "Approvals that don't get lost",
    body: "Requests go to the right person, with a clear owner and due date, until someone decides.",
  },
  {
    title: "One list for the work that matters",
    body: "Tasks, renewals and recurring checks live together, sorted by what needs attention first.",
  },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm font-medium">
          <a
            href="#features"
            className="hidden px-3 py-2 text-ink-soft hover:text-ink sm:block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hidden px-3 py-2 text-ink-soft hover:text-ink sm:block"
          >
            Pricing
          </a>
          <Link href="/login" className="px-3 py-2 hover:text-brand">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-ink px-4 py-2 text-white hover:bg-brand"
          >
            Create workspace
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Operations, finally in one loop.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Opsly gives your team a private workspace for tasks, approvals and
              recurring work, so nothing waits on a forgotten email.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
              >
                Create your workspace
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-line bg-card px-6 py-3 font-semibold hover:border-ink"
              >
                See the dashboard
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              Free for teams up to 5. No card needed.
            </p>
          </div>

          <div
            className="board-in rounded-2xl border border-line bg-card p-5 shadow-[0_20px_50px_-20px_rgba(18,32,58,0.25)]"
            aria-label="Example Opsly task board"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold">
                  Today at Brightline
                </p>
                <p className="text-sm text-ink-soft">4 open, 1 needs you</p>
              </div>
              <span className="rounded-full bg-ok-tint px-3 py-1 text-xs font-semibold text-ok">
                On track
              </span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li
                  key={r.name}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-sm text-ink-soft">{r.who}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[r.tone]}`}
                  >
                    {r.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <h2 className="font-display text-xl font-semibold">
                  {f.title}
                </h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
          <div className="rounded-3xl bg-ink px-8 py-14 text-white sm:px-14">
            <h2 className="max-w-xl font-display text-4xl font-bold leading-tight">
              Set up your team's workspace in two minutes.
            </h2>
            <p className="mt-4 max-w-md text-white/70">
              Name it, pick a web address, invite your team.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-ink hover:bg-brand-tint"
            >
              Create workspace
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-10 text-sm text-ink-soft">
        <Logo />
        <p>© {new Date().getFullYear()} Opsly</p>
      </footer>
    </>
  );
}
