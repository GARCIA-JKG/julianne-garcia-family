import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMappedMemories } from "@/lib/archive";
import { PlacesMap } from "@/components/PlacesMap";

export const metadata: Metadata = {
  title: "Places"
};

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  await requireUser();
  const memories = await listMappedMemories();

  const mapMemories = memories
    .filter(
      (
        memory
      ): memory is typeof memory & {
        latitude: number;
        longitude: number;
      } =>
        memory.latitude !== null &&
        memory.longitude !== null
    )
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      dateLabel: memory.dateLabel,
      place: memory.place,
      latitude: memory.latitude,
      longitude: memory.longitude
    }));

  const countries = new Map<
    string,
    typeof memories
  >();

  for (const memory of memories) {
    const key =
      memory.country ||
      memory.region ||
      "Place not fully identified";

    const existing = countries.get(key) ?? [];
    existing.push(memory);
    countries.set(key, existing);
  }

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">OUR PLACES</p>
        <h1>Where our family story happened</h1>
        <p>
          Explore approved Memories by city, state or province,
          and country. The archive stores general family-history
          locations—not street addresses.
        </p>
      </div>

      <PlacesMap memories={mapMemories} />

      <div className="place-groups">
        {Array.from(countries.entries()).map(
          ([country, group]) => (
            <section
              className="place-group"
              key={country}
            >
              <h2>{country}</h2>

              <div className="place-memory-list">
                {group.map((memory) => (
                  <Link
                    href={"/memories/" + memory.id}
                    className="place-memory-row"
                    key={memory.id}
                  >
                    <div>
                      <strong>{memory.title}</strong>
                      <span>
                        {[
                          memory.dateLabel,
                          memory.place
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )
        )}
      </div>
    </section>
  );
}
