"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const data = new FormData(event.currentTarget);
    const payload = {
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? "")
    };

    const response = await fetch(mode === "setup" ? "/api/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "setup" && (
        <label>
          Your name
          <input name="displayName" autoComplete="name" required maxLength={120} />
        </label>
      )}

      <label>
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          required
          minLength={12}
          maxLength={200}
        />
      </label>

      {mode === "setup" && (
        <p className="form-help">
          This first account becomes the family archive administrator.
        </p>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="button button-primary button-wide" disabled={busy}>
        {busy ? "Working..." : mode === "setup" ? "Create family archive" : "Sign in"}
      </button>
    </form>
  );
}
