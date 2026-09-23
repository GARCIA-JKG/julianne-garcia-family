"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function MemorySubmissionForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access was not available on this device.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");

    const data = new FormData(event.currentTarget);
    if (audioBlob) {
      data.append("media", new File([audioBlob], "family-voice-story.webm", {
        type: audioBlob.type || "audio/webm"
      }));
    }

    const response = await fetch("/api/memories", {
      method: "POST",
      body: data
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not save this memory.");
      setBusy(false);
      return;
    }

    formRef.current?.reset();
    setAudioBlob(null);
    setStatus("Memory saved. It is waiting for a family curator to review it.");
    setBusy(false);
    router.refresh();
  }

  return (
    <form ref={formRef} className="memory-form" onSubmit={submit}>
      <fieldset>
        <legend>1. Add photos, video, or a voice</legend>
        <label className="upload-zone">
          <span className="upload-icon">＋</span>
          <strong>Choose family media</strong>
          <span>Photos or videos from your phone or computer</span>
          <input name="media" type="file" multiple accept="image/*,video/*" />
        </label>

        <button type="button" className="voice-button" onClick={toggleRecording}>
          <span aria-hidden="true">{recording ? "■" : "●"}</span>
          {recording ? " Stop recording" : " Record the story in your voice"}
        </button>

        {audioBlob && !recording && (
          <p className="recording-ready">Voice story recorded and ready to upload.</p>
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

        <div className="form-row">
          <label>
            About when?
            <input type="text" name="date" maxLength={80} placeholder="1976, Summer 1994..." />
          </label>
          <label>
            Where?
            <input
              type="text"
              name="place"
              maxLength={180}
              placeholder="California, Manila, Grandma's house..."
            />
          </label>
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

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-success" role="status">{status}</p>}

      <button type="submit" className="button button-primary button-wide" disabled={busy}>
        {busy ? "Saving memory..." : "Share this memory"}
      </button>
    </form>
  );
}
