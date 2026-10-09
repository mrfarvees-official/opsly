import Link from "next/link";
import { Logo } from "@/components/logo";

const nav = ["Overview", "Tasks", "Approvals", "Team", "Settings"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[230px_1fr]">
      <aside className="border-b border-line bg-card p-5 md:border-b-0 md:border-r">
        <Logo href="/dashboard" />
        <nav className="mt-6 flex gap-1 overflow-x-auto md:flex-col" aria-label="Main">
          {nav.map((item, i) => (
            <Link
              key={item}
              href="/dashboard"
              aria-current={i === 0 ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                i === 0 ? "bg-brand-tint text-brand-dark" : "text-ink-soft hover:bg-paper"
              }`}
            >
              {item}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}