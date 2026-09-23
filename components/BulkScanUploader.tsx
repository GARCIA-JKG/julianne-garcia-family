"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UploadState = {
  total: number;
  completed: number;
  failed: number;
};

export function BulkScanUploader({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<UploadState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function uploadOne(file: File) {
    const form = new FormData();
    form.append("file", file);

    const response = await fetch(`/api/imports/batches/${batchId}/items`, {
      method: "POST",
      body: form
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error ?? "Upload failed");
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setBusy(true);
    setErrors([]);
    setState({ total: files.length, completed: 0, failed: 0 });

    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const messages: string[] = [];

    async function worker() {
      while (cursor < files.length) {
        const index = cursor++;
        const file = files[index];

        try {
          await uploadOne(file);
          completed += 1;
        } catch (error) {
          failed += 1;
          messages.push(
            `${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`
          );
        }

        setState({ total: files.length, completed, failed });
      }
    }

    await Promise.all([worker(), worker(), worker()]);
    setErrors(messages);
    setBusy(false);
    event.target.value = "";
    router.refresh();
  }

  return (
    <section className="scan-upload-panel">
      <div>
        <p className="eyebrow">BULK UPLOAD</p>
        <h2>Add scanned prints</h2>
        <p>
          Choose a whole scan session at once. Files upload three at a time so
          a large batch does not overload the family server.
        </p>
      </div>

      <label className={"upload-zone" + (busy ? " upload-busy" : "")}>
        <span className="upload-icon">＋</span>
        <strong>{busy ? "Uploading scans..." : "Choose scanned photos"}</strong>
        <span>JPG, PNG, HEIC/HEIF, WebP, GIF, or AVIF</span>
        <input
          type="file"
          accept="image/*,.heic,.heif,.avif"
          multiple
          disabled={busy}
          onChange={uploadFiles}
        />
      </label>

      {state && (
        <div className="scan-progress" role="status">
          <strong>
            {state.completed + state.failed} / {state.total}
          </strong>
          <span>
            {state.completed} uploaded
            {state.failed ? ` · ${state.failed} failed` : ""}
          </span>
          <progress
            max={state.total}
            value={state.completed + state.failed}
          />
        </div>
      )}

      {errors.length > 0 && (
        <div className="scan-errors">
          {errors.slice(0, 10).map((error) => (
            <p key={error}>{error}</p>
          ))}
          {errors.length > 10 && <p>And {errors.length - 10} more errors.</p>}
        </div>
      )}
    </section>
  );
}
