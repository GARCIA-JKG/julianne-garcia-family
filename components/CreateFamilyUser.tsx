"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateFamilyUser() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: data.get("displayName"),
        email: data.get("email"),
        password: data.get("password"),
        role: data.get("role")
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Could not create account.");
      return;
    }

    form.reset();
    setMessage("Family account created.");
    router.refresh();
  }

  return (
    <form className="family-user-form" onSubmit={submit}>
      <div className="form-row">
        <label>
          Name
          <input name="displayName" required maxLength={120} />
        </label>
        <label>
          Email
          <input name="email" type="email" required maxLength={254} />
        </label>
      </div>
      <div className="form-row">
        <label>
          Temporary password
          <input name="password" type="password" required minLength={12} maxLength={200} />
        </label>
        <label>
          Role
          <select name="role" defaultValue="family">
            <option value="family">Family — view and contribute</option>
            <option value="curator">Curator — review memories</option>
            <option value="viewer">Viewer — browse only</option>
          </select>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
      <button className="button button-primary">Create family account</button>
    </form>
  );
}
