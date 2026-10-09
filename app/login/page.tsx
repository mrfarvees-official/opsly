"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, buttonClass, inputClass } from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: String(data.get("workspace")).trim().toLowerCase(),
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      if (!res.ok) {
        setError(
          res.status < 500
            ? "Check your workspace, email and password, then try again."
            : "Couldn't sign you in. Please try again in a moment.",
        );
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Couldn't reach Opsly. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your workspace details."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block text-sm font-medium">
          Workspace address
          <input
            name="workspace"
            required
            placeholder="brightline"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-warn-tint px-3 py-2 text-sm text-warn"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New to Opsly?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand hover:underline"
        >
          Create a workspace
        </Link>
      </p>
    </AuthShell>
  );
}
