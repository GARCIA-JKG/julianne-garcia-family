import type { MediaItem } from "@/lib/archive";

export function MemoryMedia({ media }: { media: MediaItem[] }) {
  if (media.length === 0) {
    return (
      <div className="memory-detail-placeholder">
        <span>This memory is told in words.</span>
      </div>
    );
  }

  return (
    <div className="media-stack">
      {media.map((item) => {
        const src = "/api/media/" + item.id;

        if (item.kind === "photo") {
          return (
            <figure className="archive-media" key={item.id}>
              {/* Regular img is intentional: these files come from an authenticated route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={item.caption || item.originalFilename} loading="lazy" />
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          );
        }

        if (item.kind === "video") {
          return (
            <figure className="archive-media" key={item.id}>
              <video src={src} controls preload="metadata" />
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          );
        }

        return (
          <figure className="archive-media voice-media" key={item.id}>
            <strong>Hear this memory in their voice</strong>
            <audio src={src} controls preload="metadata" />
          </figure>
        );
      })}
    </div>
  );
}
