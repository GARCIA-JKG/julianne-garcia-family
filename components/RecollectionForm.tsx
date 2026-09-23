"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function RecollectionForm({ memoryId }: { memoryId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setVoice(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          })
        );
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
    } catch {
      setError("Microphone access was not available on this device.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    if (voice) {
      formData.append(
        "voice",
        new File([voice], "family-recollection.webm", {
          type: voice.type || "audio/webm"
        })
      );
    }

    const response = await fetch(
      `/api/memories/${memoryId}/recollections`,
      { method: "POST", body: formData }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not submit recollection.");
      setBusy(false);
      return;
    }

    formRef.current?.reset();
    setVoice(null);
    setMessage(
      "Your recollection was saved and is waiting for family review."
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="recollection-form" ref={formRef} onSubmit={submit}>
      <div className="recollection-form-heading">
        <p className="eyebrow">ADD YOUR PERSPECTIVE</p>
        <h3>I remember this...</h3>
        <p>
          Tell the part you remember. Your version can be different from
          someone else&apos;s—that is part of preserving family history.
        </p>
      </div>

      <label>
        What do you remember?
        <textarea
          name="story"
          rows={5}
          maxLength={8000}
          placeholder="I was seven and cried because I thought Santa forgot my present..."
        />
      </label>

      <label>
        About how old were you? <span className="optional">(optional)</span>
        <input
          name="ageAtMemory"
          maxLength={80}
          placeholder="7 years old, a teenager, about 20..."
        />
      </label>

      <div className="recollection-voice">
        <button
          type="button"
          className="voice-button"
          onClick={toggleRecording}
        >
          <span aria-hidden="true">{recording ? "■" : "●"}</span>
          {recording ? " Stop recording" : " Record this recollection"}
        </button>

        {voice && !recording && (
          <p className="recording-ready">
            Voice recollection recorded and ready to submit.
          </p>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <button
        className="button button-primary"
        disabled={busy || recording}
      >
        {busy ? "Saving recollection..." : "Share what I remember"}
      </button>
    </form>
  );
}
