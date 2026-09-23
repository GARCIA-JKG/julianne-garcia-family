"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import { MonthYearFields } from "@/components/MonthYearFields";
import { LocationFields } from "@/components/LocationFields";

type PreviewItem = {
  file: File;
  url: string | null;
  kind: "image" | "video" | "file";
};

function previewKind(file: File): PreviewItem["kind"] {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    file.type.startsWith("image/") &&
    !["heic", "heif"].includes(extension)
  ) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return "file";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MemorySubmissionForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const next = selectedFiles.map((file): PreviewItem => {
      const kind = previewKind(file);
      return {
        file,
        kind,
        url:
          kind === "image" || kind === "video"
            ? URL.createObjectURL(file)
            : null
      };
    });

    setPreviews(next);

    return () => {
      next.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setError("");
  }

  function removeFile(index: number) {
    setSelectedFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
    } catch {
      setError(
        "Microphone access was not available on this device."
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");

    const data = new FormData(event.currentTarget);
    data.delete("media");

    for (const file of selectedFiles) {
      data.append("media", file);
    }

    if (audioBlob) {
      data.append(
        "media",
        new File(
          [audioBlob],
          "family-voice-story.webm",
          {
            type: audioBlob.type || "audio/webm"
          }
        )
      );
    }

    const response = await fetch("/api/memories", {
      method: "POST",
      body: data
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        result.error ?? "Could not save this memory."
      );
      setBusy(false);
      return;
    }

    formRef.current?.reset();
    clearSelectedFiles();
    setAudioBlob(null);
    setStatus(
      "Memory saved. It is waiting for a family curator to review it."
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      className="memory-form"
      onSubmit={submit}
    >
      <fieldset>
        <legend>1. Add photos, video, or a voice</legend>

        <label className="upload-zone">
          <span className="upload-icon">＋</span>
          <strong>Choose family media</strong>
          <span>
            Photos or videos from your phone or computer
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.heic,.heif,.avif"
            onChange={chooseFiles}
          />
        </label>

        {previews.length > 0 && (
          <section
            className="upload-preview-section"
            aria-label="Selected media preview"
          >
            <div className="upload-preview-heading">
              <div>
                <strong>
                  {previews.length}{" "}
                  {previews.length === 1
                    ? "item"
                    : "items"}{" "}
                  ready
                </strong>
                <span>
                  Check these before sharing the Memory.
                </span>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={clearSelectedFiles}
              >
                Clear all
              </button>
            </div>

            <div className="upload-preview-grid">
              {previews.map((item, index) => (
                <article
                  className="upload-preview-card"
                  key={
                    item.file.name +
                    item.file.size +
                    item.file.lastModified
                  }
                >
                  <div className="upload-preview-media">
                    {item.kind === "image" &&
                    item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={
                          "Preview of " +
                          item.file.name
                        }
                      />
                    ) : item.kind === "video" &&
                      item.url ? (
                      <video
                        src={item.url}
                        controls
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="upload-file-fallback">
                        <span aria-hidden="true">▧</span>
                        <strong>
                          {item.file.name
                            .split(".")
                            .pop()
                            ?.toUpperCase() ||
                            "FILE"}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="upload-preview-details">
                    <div>
                      <strong title={item.file.name}>
                        {item.file.name}
                      </strong>
                      <span>
                        {formatBytes(item.file.size)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="preview-remove-button"
                      onClick={() =>
                        removeFile(index)
                      }
                      aria-label={
                        "Remove " +
                        item.file.name +
                        " from upload"
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          className="voice-button"
          onClick={toggleRecording}
        >
          <span aria-hidden="true">
            {recording ? "■" : "●"}
          </span>
          {recording
            ? " Stop recording"
            : " Record the story in your voice"}
        </button>

        {audioBlob && !recording && (
          <div className="voice-upload-preview">
            <div>
              <strong>Voice story ready</strong>
              <span>
                Listen before adding it to the Memory.
              </span>
            </div>

            {audioPreviewUrl && (
              <audio
                src={audioPreviewUrl}
                controls
                preload="metadata"
              />
            )}

            <button
              type="button"
              className="text-button"
              onClick={() => setAudioBlob(null)}
            >
              Remove recording
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>2. Tell the story</legend>

        <label>
          Memory title
          <input
            type="text"
            name="title"
            required
            maxLength={180}
            placeholder="Grandma's graduation, Dad's first car..."
          />
        </label>

        <div className="structured-fields">
          <div>
            <p className="field-group-title">
              About when?
            </p>
            <p className="field-group-help">
              Month and year are enough. Leave it blank
              if nobody is sure.
            </p>
            <MonthYearFields />
          </div>

          <div>
            <p className="field-group-title">Where?</p>
            <p className="field-group-help">
              Use a city, region, and country—not a
              home address.
            </p>
            <LocationFields />
          </div>
        </div>

        <label>
          Who is in this memory?
          <input
            type="text"
            name="people"
            maxLength={1000}
            placeholder="Grandma, Grandpa, Aunt Maria..."
          />
        </label>

        <label>
          What should Julianne know about this?
          <textarea
            name="story"
            rows={8}
            maxLength={12000}
            placeholder="Tell the story the way you would tell it sitting together at the kitchen table..."
          />
        </label>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {status && (
        <p className="form-success" role="status">
          {status}
        </p>
      )}

      <button
        type="submit"
        className="button button-primary button-wide"
        disabled={busy || recording}
      >
        {busy
          ? "Saving memory..."
          : "Share this memory"}
      </button>
    </form>
  );
}
