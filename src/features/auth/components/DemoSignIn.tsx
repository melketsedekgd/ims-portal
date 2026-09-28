"use client";

import { useState } from "react";
import { demoSignIn } from "@/features/auth/mutations";
import type { DemoAccount } from "@/features/auth/demo-accounts";

/**
 * "Sign in as" buttons for the demo accounts. The list comes in as a prop
 * from the login page, which only passes it when DEMO_LOGIN is on; this file
 * imports the type alone, so the list never enters the client bundle.
 */
export default function DemoSignIn({ accounts }: { accounts: readonly DemoAccount[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const signIn = async (email: string) => {
    setPending(email);
    setError(null);

    try {
      const response = await demoSignIn(email);
      // Only reached if sign-in failed — success redirects before this runs.
      if (response?.error) setError(response.error);
    } catch {
      // The action throws when DEMO_LOGIN is off or the email is not a demo
      // account; production builds strip the message, so say it plainly.
      setError("Demo sign-in is unavailable.");
    }

    setPending(null);
  };

  const highlight = (e: { currentTarget: HTMLElement }) =>
    (e.currentTarget.style.borderColor = "var(--coral)");
  const unhighlight = (e: { currentTarget: HTMLElement }) =>
    (e.currentTarget.style.borderColor = "var(--line)");

  return (
    <section className="w-full mt-7 flex flex-col gap-3" aria-labelledby="demo-sign-in">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1" style={{ backgroundColor: "var(--line)" }} />
        <h2
          id="demo-sign-in"
          className="text-[13px] font-semibold"
          style={{ color: "var(--ink-2)" }}
        >
          Quick sign-in (demo)
        </h2>
        <span className="h-px flex-1" style={{ backgroundColor: "var(--line)" }} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            title={account.email}
            disabled={pending !== null}
            onClick={() => signIn(account.email)}
            onMouseEnter={highlight}
            onMouseLeave={unhighlight}
            onFocus={highlight}
            onBlur={unhighlight}
            className="h-[44px] px-3 bg-white text-[13px] font-semibold outline-none transition-all duration-200 disabled:opacity-60 last:odd:col-span-2 flex items-center justify-center gap-2"
            style={{ border: "1.5px solid var(--line)", borderRadius: "var(--r)", color: "var(--ink-2)" }}
          >
            {pending === account.email && (
              <span className="h-3.5 w-3.5 border-2 border-coral/30 border-t-coral rounded-full animate-spin" />
            )}
            {account.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="text-[13px] font-medium p-3 text-center"
          style={{
            color: "var(--coral-600)",
            backgroundColor: "var(--coral-tint)",
            border: "1px solid var(--coral-soft)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
