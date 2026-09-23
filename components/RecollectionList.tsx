import type { Recollection } from "@/lib/recollections";

export function RecollectionList({
  recollections
}: {
  recollections: Recollection[];
}) {
  if (!recollections.length) {
    return (
      <div className="recollection-empty">
        <p>
          No additional family recollections have been added yet. Someone may
          remember the detail that makes this story come alive.
        </p>
      </div>
    );
  }

  return (
    <div className="recollection-list">
      {recollections.map((item) => (
        <article className="recollection-card" key={item.id}>
          <header>
            <div className="recollection-avatar" aria-hidden="true">
              {item.contributor.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{item.contributor}</strong>
              <span>
                {item.ageAtMemory
                  ? `About ${item.ageAtMemory} at the time`
                  : "Family recollection"}
              </span>
            </div>
          </header>

          {item.story && (
            <blockquote>
              “{item.story}”
            </blockquote>
          )}

          {item.hasVoice && (
            <div className="recollection-audio">
              <span>Hear {item.contributor} tell it</span>
              <audio
                src={"/api/recollections/" + item.id + "/voice"}
                controls
                preload="metadata"
              />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
