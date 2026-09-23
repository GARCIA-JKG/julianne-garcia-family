import Link from "next/link";
import type { ArchiveMemory } from "@/lib/archive";

export function MemoryCard({ memory }: { memory: ArchiveMemory }) {
  const first = memory.media[0];

  return (
    <article className="memory-card">
      <div className="memory-art">
        {first?.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="memory-card-image"
            src={"/api/media/" + first.id}
            alt={first.caption || memory.title}
          />
        ) : first?.kind === "video" ? (
          <span className="media-icon" aria-label="Video">▶</span>
        ) : first?.kind === "audio" ? (
          <span className="media-icon" aria-label="Voice story">●</span>
        ) : (
          <span className="media-icon" aria-hidden="true">◇</span>
        )}

        <span className="photo-corner photo-corner-one" />
        <span className="photo-corner photo-corner-two" />
      </div>

      <div className="memory-card-body">
        <p className="eyebrow">
          {memory.dateLabel || "DATE UNKNOWN"} ·{" "}
          {memory.place || "PLACE UNKNOWN"}
        </p>

        <h3>{memory.title}</h3>

        <p>
          {memory.story ||
            "This memory is waiting for its story to be told."}
        </p>

        <div className="memory-meta">
          <span>
            {memory.people.length
              ? memory.people.map((person) => person.displayName).join(" · ")
              : "People not identified yet"}
          </span>

          <span>
            Shared by {memory.contributor || "Family"}
          </span>
        </div>

        <Link
          href={"/memories/" + memory.id}
          className="text-link"
        >
          Open memory <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
