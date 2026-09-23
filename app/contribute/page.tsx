import type { Metadata } from "next";
import { MemorySubmissionForm } from "@/components/MemorySubmissionForm";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Share a Memory" };
export const dynamic = "force-dynamic";

export default async function ContributePage() {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/memories");

  return (
    <section className="page-section contribute-layout">
      <div className="page-intro contribute-intro">
        <p className="eyebrow">SHARE A FAMILY MEMORY</p>
        <h1>Help Julianne learn the story.</h1>
        <p>
          Upload a photo or video, write what you remember, or record the story
          in your own voice. Small details matter too.
        </p>

        <div className="keepsake-note">
          <strong>Good things to include</strong>
          <p>
            Who is in it? About when was it? Where were you? What happened
            before or after? Why does this moment matter to you?
          </p>
        </div>
      </div>

      <MemorySubmissionForm />
    </section>
  );
}
