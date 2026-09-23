"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewRecollection({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review(status: "approved" | "rejected") {
    setBusy(true);
    setError("");

    const response = await fetch(
      `/api/admin/recollections/${id}/review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Could not review recollection.");
      setBusy(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="review-actions">
      <button
        className="button button-primary"
        onClick={() => review("approved")}
        disabled={busy}
      >
        Approve
      </button>
      <button
        className="button button-secondary"
        onClick={() => review("rejected")}
        disabled={busy}
      >
        Reject
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
