import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getVisibleMemory } from "@/lib/archive";
import { listMemoryHistory } from "@/lib/memory-history";
import { MemoryEnrichmentForm } from "@/components/MemoryEnrichmentForm";
import { MediaEnrichmentBoard } from "@/components/MediaEnrichmentBoard";
import { MemoryHistory } from "@/components/MemoryHistory";

export const dynamic = "force-dynamic";

export default async function EditMemoryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["admin", "curator"]);
  const { id } = await params;
  const memory = await getVisibleMemory(id, user);

  if (!memory) notFound();

  const history = await listMemoryHistory(memory.id);

  return (
    <section className="page-section memory-editor-page">
      <div className="page-intro">
        <p className="eyebrow">CURATOR WORKSPACE</p>
        <h1>Edit & enrich</h1>
        <p>
          Improve <strong>{memory.title}</strong> as the family learns more.
          Originals remain preserved even when visible media is archived.
        </p>
        <Link href={"/memories/" + memory.id} className="text-link">
          ← Back to Memory
        </Link>
      </div>

      <MemoryEnrichmentForm memory={memory} />

      <MediaEnrichmentBoard
        memoryId={memory.id}
        media={memory.media}
        coverMediaId={memory.coverMediaId}
      />

      <section className="memory-history-section">
        <div className="editor-section-heading">
          <p className="eyebrow">EDIT HISTORY</p>
          <h2>How this Memory changed</h2>
        </div>
        <MemoryHistory items={history} />
      </section>
    </section>
  );
}
