import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listPendingMemories } from "@/lib/archive";
import { listPendingRecollections } from "@/lib/recollections";
import { ReviewMemory } from "@/components/ReviewMemory";
import { ReviewRecollection } from "@/components/ReviewRecollection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(["admin", "curator"]);

  const [pendingMemories, pendingRecollections] = await Promise.all([
    listPendingMemories(),
    listPendingRecollections()
  ]);

  const allCaughtUp =
    pendingMemories.length === 0 &&
    pendingRecollections.length === 0;

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">FAMILY CURATOR</p>
        <h1>Stories waiting for review</h1>
        <p>
          Review new Memories and additional family recollections before
          they join the shared archive.
        </p>
      </div>

      {allCaughtUp && (
        <div className="empty-keepsake">
          <span>ALL CAUGHT UP</span>
          <h2>No family stories are waiting for review.</h2>
        </div>
      )}

      {pendingMemories.length > 0 && (
        <section className="review-section">
          <div className="review-section-heading">
            <p className="eyebrow">NEW MEMORIES</p>
            <h2>{pendingMemories.length} waiting</h2>
          </div>

          <div className="review-list">
            {pendingMemories.map((memory) => (
              <article className="review-card" key={memory.id}>
                <div>
                  <p className="eyebrow">
                    {memory.dateLabel || "DATE UNKNOWN"} ·{" "}
                    {memory.place || "PLACE UNKNOWN"}
                  </p>
                  <h2>{memory.title}</h2>
                  <p>
                    {memory.story ||
                      "No written story was included."}
                  </p>
                  <p className="review-meta">
                    Shared by{" "}
                    {memory.contributor || "Family member"} ·{" "}
                    {memory.media.length} media item(s)
                  </p>
                  <Link
                    href={"/memories/" + memory.id}
                    className="text-link"
                  >
                    Preview full memory →
                  </Link>
                </div>
                <ReviewMemory id={memory.id} />
              </article>
            ))}
          </div>
        </section>
      )}

      {pendingRecollections.length > 0 && (
        <section className="review-section">
          <div className="review-section-heading">
            <p className="eyebrow">FAMILY RECOLLECTIONS</p>
            <h2>{pendingRecollections.length} waiting</h2>
          </div>

          <div className="review-list">
            {pendingRecollections.map((item) => (
              <article className="review-card" key={item.id}>
                <div>
                  <p className="eyebrow">
                    ADDITIONAL PERSPECTIVE
                  </p>

                  <h2>{item.contributor} remembers...</h2>

                  {item.story && (
                    <blockquote className="review-recollection-quote">
                      “{item.story}”
                    </blockquote>
                  )}

                  <p className="review-meta">
                    On Memory:{" "}
                    <strong>{item.memoryTitle}</strong>
                    {item.ageAtMemory
                      ? ` · About ${item.ageAtMemory} at the time`
                      : ""}
                  </p>

                  {item.hasVoice && (
                    <audio
                      className="review-audio"
                      src={
                        "/api/recollections/" +
                        item.id +
                        "/voice"
                      }
                      controls
                      preload="metadata"
                    />
                  )}

                  <Link
                    href={"/memories/" + item.memoryId}
                    className="text-link"
                  >
                    Open original Memory →
                  </Link>
                </div>

                <ReviewRecollection id={item.id} />
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
