import { Suspense } from "react";

import { DashboardNav } from "@/components/dashboard-nav";
import { getDashboardNavigation } from "@/features/platform/application/dashboard-navigation";

export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper text-ink md:grid-cols-[230px_1fr]">
      <Suspense fallback={<DashboardNav items={[]} user={{ id: "", email: "", role: "workspace" }} />}>
        <DashboardNavigation />
      </Suspense>
      <div className="min-w-0 bg-paper">
        <Suspense fallback={<main className="p-6 sm:p-10"><div className="h-8 w-48 animate-pulse rounded-lg bg-line" /></main>}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardNavigation() {
  const navigation = await getDashboardNavigation();
  return <DashboardNav items={navigation.items} user={navigation.user} />;
}
