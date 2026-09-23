"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MediaItem } from "@/lib/archive";

export function MediaEnrichmentBoard({
  memoryId,
  media,
  coverMediaId
}: {
  memoryId: string;
  media: MediaItem[];
  coverMediaId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function archiveMedia(mediaId: string) {
    if (!window.confirm("Hide this media from the Memory? The original file will remain preserved.")) {
      return;
    }

    setBusy(mediaId);
    setError("");

    const response = await fetch(
      `/api/admin/memories/${memoryId}/media/${mediaId}`,
      { method: "DELETE" }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not archive media.");
      setBusy(null);
      return;
    }

    setBusy(null);
    router.refresh();
  }

  async function saveMedia(
    event: FormEvent<HTMLFormElement>,
    mediaId: string
  ) {
    event.preventDefault();
    setBusy(mediaId);
    setError("");

    const data = new FormData(event.currentTarget);

    const response = await fetch(
      `/api/admin/memories/${memoryId}/media/${mediaId}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption: data.get("caption"),
          sortOrder: data.get("sortOrder"),
          makeCover: data.get("makeCover") === "on"
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not update media.");
      setBusy(null);
      return;
    }

    setBusy(null);
    router.refresh();
  }

  if (!media.length) return null;

  return (
    <section className="media-enrichment-board">
      <div className="editor-section-heading">
        <p className="eyebrow">MEDIA DETAILS</p>
        <h2>Captions, order & cover</h2>
      </div>

      <div className="media-editor-grid">
        {media.map((item, index) => (
          <form
            className="media-editor-card"
            key={item.id}
            onSubmit={(event) => saveMedia(event, item.id)}
          >
            <div className="media-editor-preview">
              {item.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={"/api/media/" + item.id}
                  alt={item.caption || item.originalFilename}
                />
              ) : item.kind === "video" ? (
                <video
                  src={"/api/media/" + item.id}
                  controls
                  preload="metadata"
                />
              ) : (
                <audio
                  src={"/api/media/" + item.id}
                  controls
                  preload="metadata"
                />
              )}
            </div>

            <label>
              Caption
              <textarea
                name="caption"
                rows={3}
                maxLength={1000}
                defaultValue={item.caption ?? ""}
                placeholder="Grandpa on the left, Aunt Maria in the middle..."
              />
            </label>

            <label>
              Display order
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={item.sortOrder ?? index}
              />
            </label>

            {item.kind === "photo" && (
              <label className="cover-checkbox">
                <input
                  name="makeCover"
                  type="checkbox"
                  defaultChecked={item.id === coverMediaId}
                />
                Use as cover photo
              </label>
            )}

            <div className="media-editor-actions">
              <button
                className="button button-secondary"
                disabled={busy === item.id}
              >
                {busy === item.id ? "Saving..." : "Save media details"}
              </button>
              <button
                type="button"
                className="button button-quiet-danger"
                disabled={busy === item.id}
                onClick={() => archiveMedia(item.id)}
              >
                Archive from Memory
              </button>
            </div>
          </form>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
