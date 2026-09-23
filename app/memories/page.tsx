import type { Metadata } from "next";
import { MemoryCard } from "@/components/MemoryCard";
import { memories } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Memories"
};

export default function MemoriesPage() {
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

      <div className="filter-row" aria-label="Memory filters">
        <button className="filter active">All memories</button>
        <button className="filter">Photos</button>
        <button className="filter">Videos</button>
        <button className="filter">With a story</button>
      </div>

      <div className="memory-grid">
        {memories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>
    </section>
  );
}
