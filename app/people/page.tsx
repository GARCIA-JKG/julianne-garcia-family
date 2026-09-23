import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  await requireUser();

  const people = await query<{
    id: string;
    display_name: string;
    biography: string | null;
    memory_count: string;
  }>(
    `SELECT
       p.id,
       p.display_name,
       p.biography,
       count(mp.memory_id) FILTER (WHERE m.status = 'approved')::text AS memory_count
     FROM people p
     LEFT JOIN memory_people mp ON mp.person_id = p.id
     LEFT JOIN memories m ON m.id = mp.memory_id
     GROUP BY p.id
     ORDER BY p.display_name`
  );

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">OUR PEOPLE</p>
        <h1>The people behind the memories</h1>
        <p>
          Every name becomes a thread connecting photographs, videos, places,
          and stories across generations.
        </p>
      </div>

      {people.rows.length ? (
        <div className="people-grid">
          {people.rows.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-photo">{person.display_name.slice(0, 1).toUpperCase()}</div>
              <h2>{person.display_name}</h2>
              <p>{Number(person.memory_count) || 0} approved memories</p>
              {person.biography && <p>{person.biography}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-keepsake">
          <span>OUR PEOPLE</span>
          <h2>Names will appear here as family memories are shared.</h2>
        </div>
      )}
    </section>
  );
}
