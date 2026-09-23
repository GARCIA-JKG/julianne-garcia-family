import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPeople } from "@/lib/people";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  await requireUser();
  const people = await listPeople();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">OUR PEOPLE</p>
        <h1>The people behind the memories</h1>
        <p>
          Every name becomes a thread connecting photographs,
          videos, places, relationships, and stories across generations.
        </p>
      </div>

      {people.length ? (
        <div className="people-grid">
          {people.map((person) => (
            <Link
              className="person-card person-card-link"
              href={"/people/" + person.id}
              key={person.id}
            >
              <div className="person-photo">
                {person.displayName.slice(0, 1).toUpperCase()}
              </div>

              <h2>{person.displayName}</h2>

              {(person.birthLabel || person.deathLabel) && (
                <p>
                  {[person.birthLabel, person.deathLabel]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}

              {person.birthPlace && (
                <p>{person.birthPlace}</p>
              )}

              <p>
                {person.memoryCount} approved{" "}
                {person.memoryCount === 1 ? "Memory" : "Memories"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-keepsake">
          <span>OUR PEOPLE</span>
          <h2>
            Names will appear here as family memories are shared.
          </h2>
        </div>
      )}
    </section>
  );
}
