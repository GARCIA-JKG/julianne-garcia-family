import Link from "next/link";
import type { Memory } from "@/lib/sample-data";

const icons = {
  photo: "▧",
  video: "▶",
  mixed: "◫"
};

export function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <article className="memory-card">
      <div className="memory-art" aria-hidden="true">
        <span className="media-icon">{icons[memory.mediaType]}</span>
        <span className="photo-corner photo-corner-one" />
        <span className="photo-corner photo-corner-two" />
      </div>

      <div className="memory-card-body">
        <p className="eyebrow">
          {memory.dateLabel} · {memory.place}
        </p>
        <h3>{memory.title}</h3>
        <p>{memory.story}</p>
        <div className="memory-meta">
          <span>{memory.people.join(" · ")}</span>
          <span>Shared by {memory.contributor}</span>
        </div>
        <Link href={"/memories/" + memory.id} className="text-link">
          Open memory <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
