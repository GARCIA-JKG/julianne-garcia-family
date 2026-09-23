"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthYearFields } from "@/components/MonthYearFields";
import { LocationFields } from "@/components/LocationFields";
import type { ArchiveMemory } from "@/lib/archive";

export function MemoryEnrichmentForm({
  memory
}: {
  memory: ArchiveMemory;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);

    const response = await fetch(
      `/api/admin/memories/${memory.id}`,
      { method: "PUT", body: data }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not update Memory.");
      setBusy(false);
      return;
    }

    setMessage("Memory updated.");
    setBusy(false);
    router.refresh();
  }

  const defaultMonthYear =
    memory.memoryYear && memory.memoryMonth
      ? `${String(memory.memoryYear).padStart(4, "0")}-${String(
          memory.memoryMonth
        ).padStart(2, "0")}`
      : "";

  return (
    <form className="memory-enrichment-form" onSubmit={submit}>
      <div className="editor-section-heading">
        <p className="eyebrow">EDIT & ENRICH</p>
        <h2>Improve this Memory</h2>
        <p>
          Correct details, identify people, add captions, or attach more
          family media without recreating the Memory.
        </p>
      </div>

      <label>
        Memory title
        <input
          name="title"
          required
          maxLength={180}
          defaultValue={memory.title}
        />
      </label>

      <label>
        Main story
        <textarea
          name="story"
          rows={8}
          maxLength={12000}
          defaultValue={memory.story ?? ""}
        />
      </label>

      <div className="structured-fields">
        <div>
          <p className="field-group-title">About when?</p>
          <label className="month-picker">
            Month / year
            <input
              name="monthYear"
              type="month"
              min="1000-01"
              max="2200-12"
              defaultValue={defaultMonthYear}
            />
          </label>
        </div>

        <div>
          <p className="field-group-title">Where?</p>
          <div className="location-fields">
            <label>
              City / town
              <input
                name="locality"
                maxLength={120}
                defaultValue={memory.locality ?? ""}
              />
            </label>
            <label>
              State / province / region
              <input
                name="region"
                maxLength={120}
                defaultValue={memory.region ?? ""}
              />
            </label>
            <label>
              Country
              <input
                name="country"
                maxLength={120}
                defaultValue={memory.country ?? ""}
              />
            </label>
          </div>
        </div>
      </div>

      <label>
        People in this Memory
        <input
          name="people"
          maxLength={1000}
          defaultValue={memory.people.map((person) => person.displayName).join(", ")}
          placeholder="Grandma, Grandpa, Aunt Maria..."
        />
      </label>

      <label>
        Add more photos or video
        <input
          name="media"
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
        />
      </label>

      <label>
        Change summary
        <input
          name="changeSummary"
          maxLength={240}
          placeholder="Identified Aunt Maria and corrected the date"
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <button
        className="button button-primary button-wide"
        disabled={busy}
      >
        {busy ? "Saving changes..." : "Save Memory changes"}
      </button>
    </form>
  );
}
