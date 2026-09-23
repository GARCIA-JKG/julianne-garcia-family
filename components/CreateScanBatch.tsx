"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateScanBatch() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/imports/batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        source: data.get("source"),
        notes: data.get("notes")
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not create scan batch.");
      setBusy(false);
      return;
    }

    router.push("/admin/scans/" + result.id);
    router.refresh();
  }

  return (
    <form className="scan-batch-form" onSubmit={submit}>
      <label>
        Batch name
        <input
          name="name"
          required
          maxLength={160}
          placeholder="Grandma's photo box — September 2026"
        />
      </label>

      <div className="form-row">
        <label>
          Source
          <input
            name="source"
            maxLength={200}
            placeholder="Grandma's blue album, shoebox #2..."
          />
        </label>
        <label>
          Notes
          <input
            name="notes"
            maxLength={500}
            placeholder="Mostly California, probably 1970s–80s"
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="button button-primary" disabled={busy}>
        {busy ? "Creating..." : "Create scan batch"}
      </button>
    </form>
  );
}
