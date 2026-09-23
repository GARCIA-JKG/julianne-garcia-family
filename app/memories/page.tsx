import type { Metadata } from "next";
import { MemoryCard } from "@/components/MemoryCard";
import { requireUser } from "@/lib/auth";
import { listApprovedMemories } from "@/lib/archive";

export const metadata: Metadata = { title: "Memories" };
export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  await requireUser();
  const memories = await listApprovedMemories();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">THE FAMILY ARCHIVE</p>
        <h1>Our memories</h1>
        <p>
          Photos and videos are the doorway. The names, places, voices, and
          stories are what turn them into family history.
        </p>
      </div>

      {memories.length ? (
        <div className="memory-grid">
          {memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
        </div>
      ) : (
        <div className="empty-keepsake">
          <span>NO APPROVED MEMORIES YET</span>
          <h2>This archive grows one family story at a time.</h2>
        </div>
      )}
    </section>
  );
}
