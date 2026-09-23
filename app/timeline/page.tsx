import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamilyTree } from "@/lib/family-tree";

export const metadata: Metadata = { title: "Family Tree" };
export const dynamic = "force-dynamic";

export default async function FamilyTreePage() {
  await requireUser();
  const tree = await getFamilyTree();

  const generations = Array.from(
    { length: tree.generationCount },
    (_, index) => tree.people.filter((person) => person.generation === index)
  );

  return (
    <section className="page-section family-tree-page">
      <div className="page-intro">
        <p className="eyebrow">OUR FAMILY STORY</p>
        <h1>Family Tree</h1>
        <p>
          Follow our family across generations. Names and connections are shown
          without assigning family titles in the public tree.
        </p>
      </div>

      {tree.people.length ? (
        <div className="family-tree">
          {generations.map((people, index) => (
            <section className="family-generation" key={index}>
              <div className="generation-marker">
                <span>Generation {index + 1}</span>
              </div>

              <div className="generation-people">
                {people.map((person) => {
                  const connectedIds = new Set(
                    tree.connections.flatMap((connection) =>
                      connection.leftId === person.id
                        ? [connection.rightId]
                        : connection.rightId === person.id
                          ? [connection.leftId]
                          : []
                    )
                  );

                  const descendants = tree.branches.filter(
                    (branch) => branch.fromId === person.id
                  ).length;

                  return (
                    <Link
                      href={"/people/" + person.id}
                      className="family-tree-person"
                      key={person.id}
                    >
                      <div className="family-tree-monogram">
                        {person.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="family-tree-person-copy">
                        <h2>{person.displayName}</h2>
                        {(person.birthLabel || person.deathLabel) && (
                          <p>
                            {[person.birthLabel, person.deathLabel]
                              .filter(Boolean)
                              .join(" — ")}
                          </p>
                        )}
                        {person.birthPlace && <p>{person.birthPlace}</p>}
                        <span>
                          {person.memoryCount}{" "}
                          {person.memoryCount === 1 ? "Memory" : "Memories"}
                          {connectedIds.size > 0
                            ? " · " + connectedIds.size + " connection" + (connectedIds.size === 1 ? "" : "s")
                            : ""}
                          {descendants > 0
                            ? " · " + descendants + " branch" + (descendants === 1 ? "" : "es")
                            : ""}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-keepsake">
          <span>FAMILY TREE</span>
          <h2>Add people and connect them to begin the family story.</h2>
        </div>
      )}
    </section>
  );
}
