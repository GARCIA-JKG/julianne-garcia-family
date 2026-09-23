import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listPendingMemories } from "@/lib/archive";
import { ReviewMemory } from "@/components/ReviewMemory";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(["admin", "curator"]);
  const pending = await listPendingMemories();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">FAMILY CURATOR</p>
        <h1>Memories waiting for review</h1>
        <p>
          Review family submissions before they join the shared archive. The original
          upload stays preserved while you decide whether it is ready for the family.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="empty-keepsake">
          <span>ALL CAUGHT UP</span>
          <h2>No memories are waiting for review.</h2>
        </div>
      ) : (
        <div className="review-list">
          {pending.map((memory) => (
            <article className="review-card" key={memory.id}>
              <div>
                <p className="eyebrow">{memory.dateLabel || "DATE UNKNOWN"} · {memory.place || "PLACE UNKNOWN"}</p>
                <h2>{memory.title}</h2>
                <p>{memory.story || "No written story was included."}</p>
                <p className="review-meta">
                  Shared by {memory.contributor || "Family member"} · {memory.media.length} media item(s)
                </p>
                <Link href={"/memories/" + memory.id} className="text-link">
                  Preview full memory →
                </Link>
              </div>
              <ReviewMemory id={memory.id} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
