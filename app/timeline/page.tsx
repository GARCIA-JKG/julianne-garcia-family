import type { Metadata } from "next";

export const metadata: Metadata = { title: "Timeline" };

export default function TimelinePage() {
  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">THROUGH THE YEARS</p>
        <h1>Our family timeline</h1>
        <p>
          This will grow into a chronological journey through family memories,
          milestones, moves, celebrations, and everyday life.
        </p>
      </div>
      <div className="empty-keepsake">
        <span>1940 → Today</span>
        <h2>The timeline starts with the stories you preserve.</h2>
        <p>
          Once memories have real dates, they will appear here automatically.
        </p>
      </div>
    </section>
  );
}
