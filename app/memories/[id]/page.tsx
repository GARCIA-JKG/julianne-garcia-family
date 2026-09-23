import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getVisibleMemory } from "@/lib/archive";
import { MemoryMedia } from "@/components/MemoryMedia";

export const dynamic = "force-dynamic";

export default async function MemoryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const memory = await getVisibleMemory(id, user);

  if (!memory) notFound();

  return (
    <article className="page-section memory-detail">
      <Link href="/memories" className="text-link">← Back to memories</Link>

      <div className="memory-detail-grid">
        <div className="memory-detail-media">
          <MemoryMedia media={memory.media} />
        </div>

        <div className="memory-detail-story">
          <p className="eyebrow">
            {memory.dateLabel || "DATE UNKNOWN"} · {memory.place || "PLACE UNKNOWN"}
          </p>
          <h1>{memory.title}</h1>
          <p className="memory-story">
            {memory.story || "This memory does not have a written story yet."}
          </p>

          <dl className="memory-facts">
            <div>
              <dt>People</dt>
              <dd>{memory.people.length ? memory.people.join(", ") : "Not identified yet"}</dd>
            </div>
            <div>
              <dt>Shared by</dt>
              <dd>{memory.contributor || "Family member"}</dd>
            </div>
            {memory.status !== "approved" && (
              <div>
                <dt>Status</dt>
                <dd>{memory.status}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </article>
  );
}
