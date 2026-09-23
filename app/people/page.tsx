import type { Metadata } from "next";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">OUR PEOPLE</p>
        <h1>The people behind the memories</h1>
        <p>
          Each family member will eventually have a page bringing together the
          photos, videos, stories, places, and memories connected to them.
        </p>
      </div>

      <div className="people-grid">
        {["Grandma", "Grandpa", "Mom", "Dad", "Julianne"].map((person) => (
          <article className="person-card" key={person}>
            <div className="person-photo">{person.slice(0, 1)}</div>
            <h2>{person}</h2>
            <p>Family stories coming soon.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
