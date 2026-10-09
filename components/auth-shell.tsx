import { Logo } from "@/components/logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-14">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <aside className="hidden flex-col justify-end border-l border-line bg-brand-tint p-14 text-ink lg:flex">
        <p className="max-w-md font-display text-3xl font-semibold leading-snug">
          “We stopped chasing approvals in chat. Now they just get done.”
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Sample testimonial, replace with a real customer quote.
        </p>
      </aside>
    </div>
  );
}

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-card px-3.5 py-2.5 outline-none focus:border-brand";
export const buttonClass =
  "w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60";
