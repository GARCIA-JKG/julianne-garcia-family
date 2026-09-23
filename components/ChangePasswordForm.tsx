"use client";

import { FormEvent, useState } from "react";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");

    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.get("currentPassword"),
        newPassword: next
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Could not change password.");
      return;
    }

    form.reset();
    setMessage("Password updated.");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Current password
        <input name="currentPassword" type="password" autoComplete="current-password" required />
      </label>
      <label>
        New password
        <input name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label>
        Confirm new password
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
      <button className="button button-primary">Change password</button>
    </form>
  );
}
