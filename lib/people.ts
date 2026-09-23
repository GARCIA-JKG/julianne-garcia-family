import { query } from "@/lib/db";
import { formatMonthYear } from "@/lib/date-location";

export type PersonSummary = {
  id: string;
  displayName: string;
  biography: string | null;
  birthLabel: string | null;
  deathLabel: string | null;
  birthPlace: string | null;
  memoryCount: number;
  recollectionCount: number;
};

export type PersonRelationship = {
  relatedPersonId: string;
  relatedName: string;
  label: string;
};

export type PersonMemory = {
  id: string;
  title: string;
  dateLabel: string | null;
  place: string | null;
  coverMediaId: string | null;
  photoMediaId: string | null;
};

export async function listPeople() {
  const result = await query<{
    id: string;
    display_name: string;
    biography: string | null;
    birth_year: number | null;
    birth_month: number | null;
    death_year: number | null;
    death_month: number | null;
    birth_place: string | null;
    memory_count: string;
    recollection_count: string;
  }>(
    `SELECT
       p.id,
       p.display_name,
       p.biography,
       p.birth_year,
       p.birth_month,
       p.death_year,
       p.death_month,
       p.birth_place,
       count(DISTINCT mp.memory_id)
         FILTER (WHERE m.status = 'approved')::text AS memory_count,
       count(DISTINCT r.id)
         FILTER (WHERE r.status = 'approved')::text AS recollection_count
     FROM people p
     LEFT JOIN memory_people mp ON mp.person_id = p.id
     LEFT JOIN memories m ON m.id = mp.memory_id
     LEFT JOIN recollections r
       ON r.memory_id = m.id
       AND r.contributed_by IN (
         SELECT u.id
         FROM users u
         WHERE lower(u.display_name) = lower(p.display_name)
       )
     GROUP BY p.id
     ORDER BY p.display_name`
  );

  return result.rows.map((row): PersonSummary => ({
    id: row.id,
    displayName: row.display_name,
    biography: row.biography,
    birthLabel: formatMonthYear(row.birth_month, row.birth_year),
    deathLabel: formatMonthYear(row.death_month, row.death_year),
    birthPlace: row.birth_place,
    memoryCount: Number(row.memory_count),
    recollectionCount: Number(row.recollection_count)
  }));
}

export async function getPersonProfile(id: string) {
  const result = await query<{
    id: string;
    display_name: string;
    biography: string | null;
    birth_year: number | null;
    birth_month: number | null;
    death_year: number | null;
    death_month: number | null;
    birth_place: string | null;
  }>(
    `SELECT
       id,
       display_name,
       biography,
       birth_year,
       birth_month,
       death_year,
       death_month,
       birth_place
     FROM people
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  const person = result.rows[0];
  if (!person) return null;

  const [relationships, memories] = await Promise.all([
    query<{
      related_person_id: string;
      related_name: string;
      relationship_label: string;
    }>(
      `SELECT
         pr.related_person_id,
         rp.display_name AS related_name,
         pr.relationship_label
       FROM person_relationships pr
       JOIN people rp ON rp.id = pr.related_person_id
       WHERE pr.person_id = $1
       ORDER BY pr.relationship_label, rp.display_name`,
      [id]
    ),
    query<{
      id: string;
      title: string;
      date_label: string | null;
      place_name: string | null;
      cover_media_id: string | null;
      photo_media_id: string | null;
    }>(
      `SELECT
         m.id,
         m.title,
         COALESCE(
           m.approximate_date_label,
           to_char(m.memory_date, 'YYYY-MM-DD')
         ) AS date_label,
         m.place_name,
         m.cover_media_id,
         (
           SELECT md.id
           FROM media md
           WHERE md.memory_id = m.id
             AND md.kind = 'photo'
           ORDER BY
             CASE WHEN md.id = m.cover_media_id THEN 0 ELSE 1 END,
             md.sort_order,
             md.created_at
           LIMIT 1
         ) AS photo_media_id
       FROM memory_people mp
       JOIN memories m ON m.id = mp.memory_id
       WHERE mp.person_id = $1
         AND m.status = 'approved'
       ORDER BY
         COALESCE(
           m.memory_year,
           EXTRACT(YEAR FROM m.memory_date)::int,
           EXTRACT(YEAR FROM m.created_at)::int
         ),
         COALESCE(m.memory_month, 1),
         m.created_at`,
      [id]
    )
  ]);

  return {
    id: person.id,
    displayName: person.display_name,
    biography: person.biography,
    birthYear: person.birth_year,
    birthMonth: person.birth_month,
    deathYear: person.death_year,
    deathMonth: person.death_month,
    birthLabel: formatMonthYear(person.birth_month, person.birth_year),
    deathLabel: formatMonthYear(person.death_month, person.death_year),
    birthPlace: person.birth_place,
    relationships: relationships.rows.map(
      (row): PersonRelationship => ({
        relatedPersonId: row.related_person_id,
        relatedName: row.related_name,
        label: row.relationship_label
      })
    ),
    memories: memories.rows.map(
      (row): PersonMemory => ({
        id: row.id,
        title: row.title,
        dateLabel: row.date_label,
        place: row.place_name,
        coverMediaId: row.cover_media_id,
        photoMediaId: row.photo_media_id
      })
    )
  };
}

export async function listOtherPeople(excludeId?: string) {
  const result = await query<{ id: string; display_name: string }>(
    `SELECT id, display_name
     FROM people
     WHERE ($1::uuid IS NULL OR id <> $1)
     ORDER BY display_name`,
    [excludeId ?? null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name
  }));
}
