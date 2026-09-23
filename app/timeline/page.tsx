import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listApprovedMemories } from "@/lib/archive";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  await requireUser();
  const memories = await listApprovedMemories();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">THROUGH THE YEARS</p>
        <h1>Our family timeline</h1>
        <p>
          A chronological journey through family memories, milestones, moves,
          celebrations, and everyday life.
        </p>
      </div>

      {memories.length ? (
        <div className="archive-timeline">
          {memories.map((memory) => (
            <article key={memory.id} className="archive-timeline-item">
              <div className="timeline-date">{memory.dateLabel || "Date unknown"}</div>
              <div className="timeline-dot" />
              <div className="timeline-story">
                <p className="eyebrow">{memory.place || "PLACE UNKNOWN"}</p>
                <h2>{memory.title}</h2>
                <p>{memory.story || "This memory is waiting for its story."}</p>
                <Link className="text-link" href={"/memories/" + memory.id}>Open memory →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-keepsake">
          <span>1940 → TODAY</span>
          <h2>The timeline starts with the stories you preserve.</h2>
        </div>
      )}
    </section>
  );
}
