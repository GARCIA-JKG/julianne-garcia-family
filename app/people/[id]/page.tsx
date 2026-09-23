import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getPersonProfile,
  listOtherPeople
} from "@/lib/people";
import { PersonProfileEditor } from "@/components/PersonProfileEditor";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const person = await getPersonProfile(id);

  if (!person) notFound();

  const canCurate =
    user.role === "admin" || user.role === "curator";
  const otherPeople = canCurate
    ? await listOtherPeople(person.id)
    : [];

  const lifespan = [
    person.birthLabel,
    person.deathLabel
  ]
    .filter(Boolean)
    .join(" — ");

  const places = Array.from(
    new Set(
      person.memories
        .map((memory) => memory.place)
        .filter((value): value is string => Boolean(value))
    )
  );

  return (
    <section className="page-section person-profile-page">
      <Link href="/people" className="text-link">
        ← Back to people
      </Link>

      <header className="person-profile-hero">
        <div className="person-profile-monogram">
          {person.displayName.slice(0, 1).toUpperCase()}
        </div>

        <div>
          <p className="eyebrow">FAMILY PROFILE</p>
          <h1>{person.displayName}</h1>
          {lifespan && <p className="person-lifespan">{lifespan}</p>}
          {person.birthPlace && (
            <p className="person-origin">From {person.birthPlace}</p>
          )}
        </div>
      </header>

      <div className="person-profile-layout">
        <div>
          <section className="person-biography">
            <p className="eyebrow">THEIR STORY</p>
            <h2>What we know</h2>
            <p>
              {person.biography ||
                "This person’s biography has not been written yet. Their connected Memories are already beginning to tell the story."}
            </p>
          </section>

          <section className="person-memory-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CONNECTED MEMORIES</p>
                <h2>{person.memories.length} family stories</h2>
              </div>
            </div>

            <div className="person-memory-grid">
              {person.memories.map((memory) => (
                <Link
                  className="person-memory-card"
                  href={"/memories/" + memory.id}
                  key={memory.id}
                >
                  <div className="person-memory-image">
                    {memory.photoMediaId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={"/api/media/" + memory.photoMediaId}
                        alt={memory.title}
                      />
                    ) : (
                      <span>◇</span>
                    )}
                  </div>

                  <div>
                    <p className="eyebrow">
                      {memory.dateLabel || "DATE UNKNOWN"}
                    </p>
                    <h3>{memory.title}</h3>
                    {memory.place && <p>{memory.place}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="person-profile-sidebar">
          {person.relationships.length > 0 && (
            <section>
              <p className="eyebrow">FAMILY CONNECTIONS</p>
              <div className="relationship-list">
                {person.relationships.map((relationship) => (
                  <Link
                    href={"/people/" + relationship.relatedPersonId}
                    key={
                      relationship.relatedPersonId +
                      relationship.label
                    }
                  >
                    <strong>{relationship.relatedName}</strong>
                    <span>{relationship.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {places.length > 0 && (
            <section>
              <p className="eyebrow">PLACES IN THEIR STORY</p>
              <div className="person-place-list">
                {places.map((place) => (
                  <span key={place}>{place}</span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {canCurate && (
        <PersonProfileEditor
          person={person}
          otherPeople={otherPeople}
        />
      )}
    </section>
  );
}
