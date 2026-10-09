"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, buttonClass, inputClass } from "@/components/auth-shell";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: name.trim(),
          tenantSlug: slug,
          email: data.get("email"),
          password,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          res.status < 500 && body?.error
            ? body.error
            : "Couldn't create the workspace. Please try again in a moment.",
        );
        return;
      }
      router.push("/login");
    } catch {
      setError("Couldn't reach Opsly. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Free for teams up to 5. No card needed."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block text-sm font-medium">
          Company name
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toSlug(e.target.value));
            }}
            placeholder="Brightline Logistics"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Workspace address
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(toSlug(e.target.value));
            }}
            className={inputClass}
            aria-describedby="slug-hint"
          />
          <span id="slug-hint" className="mt-1 block text-xs text-ink-soft">
            Lowercase letters, numbers and hyphens. You'll use this to sign in.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Work email
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
            minLength={12}
            autoComplete="new-password"
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
        <button
          type="submit"
          disabled={pending || !slug}
          className={buttonClass}
        >
          {pending ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already have a workspace?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
