"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DashboardNavItem } from "@/features/platform/application/dashboard-navigation";

export function DashboardNav({
  items,
  user,
}: {
  items: readonly DashboardNavItem[];
  user: { id: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="border-b border-line bg-card md:sticky md:top-0 md:h-screen md:self-start md:border-b-0 md:border-r">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Opsly dashboard">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">O</span>
            <span className="font-display text-xl font-bold tracking-tight">Opsly</span>
          </Link>
          <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-dark">
            {user.role}
          </span>
        </div>

        <nav className="mt-8 flex gap-1 overflow-x-auto md:flex-col" aria-label="Workspace">
          <NavLink href="/dashboard" label="Overview" pathname={pathname} />
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
          ))}
        </nav>

        <div className="relative mt-auto hidden border-t border-line pt-4 md:block">
          {accountOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-3 rounded-2xl border border-line bg-card p-2 shadow-[0_18px_45px_-22px_rgba(18,32,58,0.45)]">
              <Link href={`/dashboard/users/${user.id}`} onClick={() => setAccountOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">Profile</Link>
              <Link href="/dashboard/settings" onClick={() => setAccountOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">Settings</Link>
              <button type="button" onClick={logout} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bad hover:bg-red-50">Log out</button>
            </div>
          )}
          <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-paper">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint font-semibold text-brand-dark">{user.email.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.email}</span><span className="mt-1 block text-xs text-ink-soft">Private workspace</span></span>
            <span className="text-lg text-ink-soft">⋯</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active ? "bg-brand-tint text-brand-dark" : "text-ink-soft hover:bg-paper hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
