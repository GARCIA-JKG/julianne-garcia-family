import { query } from "@/lib/db";
import { formatMonthYear } from "@/lib/date-location";

export type FamilyTreePerson = {
  id: string;
  displayName: string;
  birthLabel: string | null;
  deathLabel: string | null;
  birthPlace: string | null;
  memoryCount: number;
  generation: number;
};

export type FamilyTreeBranch = {
  fromId: string;
  toId: string;
};

export type FamilyTreeConnection = {
  leftId: string;
  rightId: string;
};

export type FamilyTreeData = {
  people: FamilyTreePerson[];
  branches: FamilyTreeBranch[];
  connections: FamilyTreeConnection[];
  generationCount: number;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export async function getFamilyTree(): Promise<FamilyTreeData> {
  const [peopleResult, relationshipResult] = await Promise.all([
    query<{
      id: string;
      display_name: string;
      birth_year: number | null;
      birth_month: number | null;
      death_year: number | null;
      death_month: number | null;
      birth_place: string | null;
      memory_count: string;
    }>(
      `SELECT
         p.id,
         p.display_name,
         p.birth_year,
         p.birth_month,
         p.death_year,
         p.death_month,
         p.birth_place,
         count(DISTINCT mp.memory_id)
           FILTER (WHERE m.status = 'approved')::text AS memory_count
       FROM people p
       LEFT JOIN memory_people mp ON mp.person_id = p.id
       LEFT JOIN memories m ON m.id = mp.memory_id
       GROUP BY p.id
       ORDER BY
         p.birth_year NULLS LAST,
         p.birth_month NULLS LAST,
         p.display_name`
    ),
    query<{
      person_id: string;
      related_person_id: string;
      relationship_label: string;
    }>(
      `SELECT person_id, related_person_id, relationship_label
       FROM person_relationships`
    )
  ]);

  const personIds = new Set(peopleResult.rows.map((row) => row.id));
  const branchKeys = new Set<string>();
  const connectionKeys = new Set<string>();

  const branches: FamilyTreeBranch[] = [];
  const connections: FamilyTreeConnection[] = [];

  for (const relationship of relationshipResult.rows) {
    if (
      !personIds.has(relationship.person_id) ||
      !personIds.has(relationship.related_person_id)
    ) {
      continue;
    }

    if (relationship.relationship_label === "parent") {
      const fromId = relationship.related_person_id;
      const toId = relationship.person_id;
      const key = fromId + ":" + toId;

      if (!branchKeys.has(key)) {
        branchKeys.add(key);
        branches.push({ fromId, toId });
      }
    }

    if (relationship.relationship_label === "spouse") {
      const key = pairKey(
        relationship.person_id,
        relationship.related_person_id
      );

      if (!connectionKeys.has(key)) {
        connectionKeys.add(key);
        const [leftId, rightId] = [
          relationship.person_id,
          relationship.related_person_id
        ].sort();
        connections.push({ leftId, rightId });
      }
    }
  }

  const parentsByChild = new Map<string, string[]>();
  for (const branch of branches) {
    const parents = parentsByChild.get(branch.toId) ?? [];
    parents.push(branch.fromId);
    parentsByChild.set(branch.toId, parents);
  }

  const generation = new Map<string, number>();

  function depthFor(id: string, path = new Set<string>()): number {
    const existing = generation.get(id);
    if (existing !== undefined) return existing;

    if (path.has(id)) {
      generation.set(id, 0);
      return 0;
    }

    const nextPath = new Set(path);
    nextPath.add(id);

    const parents = parentsByChild.get(id) ?? [];
    if (!parents.length) {
      generation.set(id, 0);
      return 0;
    }

    const depth =
      Math.max(...parents.map((parentId) => depthFor(parentId, nextPath))) + 1;
    generation.set(id, depth);
    return depth;
  }

  for (const id of personIds) {
    depthFor(id);
  }

  // Keep connected adult family units on the same visual generation when
  // one side has a deeper known ancestry. The labels remain internal only.
  for (let pass = 0; pass < peopleResult.rows.length + 2; pass += 1) {
    let changed = false;

    for (const connection of connections) {
      const left = generation.get(connection.leftId) ?? 0;
      const right = generation.get(connection.rightId) ?? 0;
      const target = Math.max(left, right);

      if (left !== target) {
        generation.set(connection.leftId, target);
        changed = true;
      }
      if (right !== target) {
        generation.set(connection.rightId, target);
        changed = true;
      }
    }

    for (const branch of branches) {
      const parentGeneration = generation.get(branch.fromId) ?? 0;
      const childGeneration = generation.get(branch.toId) ?? 0;
      const minimumChildGeneration = parentGeneration + 1;

      if (childGeneration < minimumChildGeneration) {
        generation.set(branch.toId, minimumChildGeneration);
        changed = true;
      }
    }

    if (!changed) break;
  }

  const people = peopleResult.rows
    .map(
      (row): FamilyTreePerson => ({
        id: row.id,
        displayName: row.display_name,
        birthLabel: formatMonthYear(row.birth_month, row.birth_year),
        deathLabel: formatMonthYear(row.death_month, row.death_year),
        birthPlace: row.birth_place,
        memoryCount: Number(row.memory_count),
        generation: generation.get(row.id) ?? 0
      })
    )
    .sort((a, b) => {
      if (a.generation !== b.generation) {
        return a.generation - b.generation;
      }

      const aRow = peopleResult.rows.find((row) => row.id === a.id);
      const bRow = peopleResult.rows.find((row) => row.id === b.id);

      const aYear = aRow?.birth_year ?? Number.MAX_SAFE_INTEGER;
      const bYear = bRow?.birth_year ?? Number.MAX_SAFE_INTEGER;

      if (aYear !== bYear) return aYear - bYear;
      return a.displayName.localeCompare(b.displayName);
    });

  const generationCount = people.length
    ? Math.max(...people.map((person) => person.generation)) + 1
    : 0;

  return {
    people,
    branches,
    connections,
    generationCount
  };
}
