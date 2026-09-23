"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanItem } from "@/lib/imports";
import { MonthYearFields } from "@/components/MonthYearFields";
import { LocationFields } from "@/components/LocationFields";

export function ScanCurationBoard({
  batchId,
  items
}: {
  batchId: string;
  items: ScanItem[];
}) {
  const router = useRouter();
  const pending = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAll() {
    setSelected(
      selected.length === pending.length
        ? []
        : pending.map((item) => item.id)
    );
  }

  async function curate(formData: FormData) {
    setBusy(true);
    setError("");

    const response = await fetch(
      `/api/imports/batches/${batchId}/curate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemIds: selected,
          title: formData.get("title"),
          month: formData.get("month"),
          year: formData.get("year"),
          locality: formData.get("locality"),
          region: formData.get("region"),
          country: formData.get("country"),
          people: formData.get("people"),
          story: formData.get("story")
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not curate these scans.");
      setBusy(false);
      return;
    }

    setSelected([]);
    setBusy(false);
    router.push("/memories/" + result.memoryId);
    router.refresh();
  }

  if (!pending.length) {
    return (
      <div className="empty-keepsake">
        <span>BATCH CURATED</span>
        <h2>No uncurated scans remain in this batch.</h2>
      </div>
    );
  }

  return (
    <section className="scan-curation">
      <div className="scan-toolbar">
        <div>
          <p className="eyebrow">CURATION TABLE</p>
          <h2>Group scans into a Memory</h2>
          <p>
            Select the photos that belong together, then describe that moment
            once. A Memory can contain one photo or fifty.
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={selectAll}
          type="button"
        >
          {selected.length === pending.length
            ? "Clear selection"
            : "Select all"}
        </button>
      </div>

      <div className="scan-grid">
        {pending.map((item) => {
          const active = selected.includes(item.id);

          return (
            <button
              type="button"
              className={"scan-tile" + (active ? " selected" : "")}
              key={item.id}
              onClick={() => toggle(item.id)}
              aria-pressed={active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={"/api/imports/items/" + item.id}
                alt={item.originalFilename}
                loading="lazy"
              />

              <span className="scan-check">
                {active ? "✓" : ""}
              </span>

              <span className="scan-name">
                {item.originalFilename}
              </span>
            </button>
          );
        })}
      </div>

      <form
        className="scan-curate-form"
        action={(data) => void curate(data)}
      >
        <div className="scan-selection-count">
          <strong>{selected.length}</strong> scans selected
        </div>

        <label>
          Memory title
          <input
            name="title"
            maxLength={180}
            required
            placeholder="Christmas at Grandma's house"
          />
        </label>

        <div className="structured-fields">
          <div>
            <p className="field-group-title">About when?</p>
            <MonthYearFields />
          </div>

          <div>
            <p className="field-group-title">Where?</p>
            <LocationFields />
          </div>
        </div>

        <label>
          Who appears in these photos?
          <input
            name="people"
            maxLength={1000}
            placeholder="Grandma, Grandpa, Mom..."
          />
        </label>

        <label>
          What is the story?
          <textarea
            name="story"
            rows={5}
            maxLength={12000}
            placeholder="What should Julianne know when she sees these photos?"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button-primary button-wide"
          disabled={busy || selected.length === 0}
        >
          {busy
            ? "Creating Memory..."
            : `Curate ${selected.length || ""} selected scan${selected.length === 1 ? "" : "s"} into a Memory`}
        </button>
      </form>
    </section>
  );
}
