"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PersonOption = {
  id: string;
  displayName: string;
};

export function PersonProfileEditor({
  person,
  otherPeople
}: {
  person: {
    id: string;
    displayName: string;
    biography: string | null;
    birthYear: number | null;
    birthMonth: number | null;
    deathYear: number | null;
    deathMonth: number | null;
    birthPlace: string | null;
  };
  otherPeople: PersonOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function monthValue(month: number | null, year: number | null) {
    return month && year
      ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
      : "";
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);

    const response = await fetch(
      `/api/admin/people/${person.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: data.get("displayName"),
          biography: data.get("biography"),
          birthMonthYear: data.get("birthMonthYear"),
          deathMonthYear: data.get("deathMonthYear"),
          birthPlace: data.get("birthPlace")
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not update person.");
      setBusy(false);
      return;
    }

    setMessage("Person profile updated.");
    setBusy(false);
    router.refresh();
  }

  async function addRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch(
      `/api/admin/people/${person.id}/relationships`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          relatedPersonId: data.get("relatedPersonId"),
          label: data.get("label")
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Could not add relationship.");
      setBusy(false);
      return;
    }

    form.reset();
    setMessage("Relationship added.");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="person-editor">
      <div className="editor-section-heading">
        <p className="eyebrow">CURATOR TOOLS</p>
        <h2>Enrich this person</h2>
      </div>

      <form className="person-profile-form" onSubmit={saveProfile}>
        <label>
          Display name
          <input
            name="displayName"
            required
            maxLength={160}
            defaultValue={person.displayName}
          />
        </label>

        <label>
          Biography / life story
          <textarea
            name="biography"
            rows={7}
            maxLength={12000}
            defaultValue={person.biography ?? ""}
            placeholder="What should future generations know about this person?"
          />
        </label>

        <div className="form-row">
          <label>
            Birth month / year
            <input
              name="birthMonthYear"
              type="month"
              min="1000-01"
              max="2200-12"
              defaultValue={monthValue(
                person.birthMonth,
                person.birthYear
              )}
            />
          </label>

          <label>
            Death month / year
            <input
              name="deathMonthYear"
              type="month"
              min="1000-01"
              max="2200-12"
              defaultValue={monthValue(
                person.deathMonth,
                person.deathYear
              )}
            />
          </label>
        </div>

        <label>
          Birth place
          <input
            name="birthPlace"
            maxLength={220}
            defaultValue={person.birthPlace ?? ""}
            placeholder="Manila, Philippines"
          />
        </label>

        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving..." : "Save person profile"}
        </button>
      </form>

      <form className="relationship-form" onSubmit={addRelationship}>
        <h3>Add a family relationship</h3>

        <div className="form-row">
          <label>
            Relative
            <select name="relatedPersonId" required defaultValue="">
              <option value="" disabled>
                Select a person
              </option>
              {otherPeople.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Relationship
            <select name="label" required defaultValue="">
              <option value="" disabled>
                Select relationship
              </option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="spouse">Spouse</option>
              <option value="sibling">Sibling</option>
              <option value="grandparent">Grandparent</option>
              <option value="grandchild">Grandchild</option>
              <option value="aunt/uncle">Aunt / Uncle</option>
              <option value="niece/nephew">Niece / Nephew</option>
              <option value="cousin">Cousin</option>
              <option value="other family">Other family</option>
            </select>
          </label>
        </div>

        <button className="button button-secondary" disabled={busy}>
          Add relationship
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
    </section>
  );
}
