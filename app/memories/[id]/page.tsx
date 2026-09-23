import Link from "next/link";
import { notFound } from "next/navigation";
import { memories } from "@/lib/sample-data";

export function generateStaticParams() {
  return memories.map((memory) => ({ id: memory.id }));
}

export default async function MemoryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memory = memories.find((item) => item.id === id);

  if (!memory) {
    notFound();
  }

  return (
    <article className="page-section memory-detail">
      <Link href="/memories" className="text-link">
        ← Back to memories
      </Link>

      <div className="memory-detail-grid">
        <div className="memory-detail-media">
          <div className="memory-detail-placeholder">
            <span>{memory.mediaType === "video" ? "▶ family video" : "family media"}</span>
          </div>
          <p>
            This area will display the original family photo, video, or a
            gallery of media connected to the memory.
          </p>
        </div>

        <div className="memory-detail-story">
          <p className="eyebrow">
            {memory.dateLabel} · {memory.place}
          </p>
          <h1>{memory.title}</h1>
          <p className="memory-story">{memory.story}</p>

          <dl className="memory-facts">
            <div>
              <dt>People</dt>
              <dd>{memory.people.join(", ")}</dd>
            </div>
            <div>
              <dt>Shared by</dt>
              <dd>{memory.contributor}</dd>
            </div>
          </dl>

          <section className="voice-story">
            <span aria-hidden="true">◉</span>
            <div>
              <strong>Voice story</strong>
              <p>
                Soon, family members will be able to record the story in their
                own voice and attach it to this memory.
              </p>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
