import Link from "next/link";
import { MemoryCard } from "@/components/MemoryCard";
import { memories } from "@/lib/sample-data";

const years = ["1940", "1960", "1980", "2000", "2020", "Today"];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A FAMILY HISTORY PROJECT</p>
          <h1>
            Every picture has a story.
            <span>Let&apos;s make sure ours are remembered.</span>
          </h1>
          <p className="hero-intro">
            I&apos;m collecting the photos, videos, voices, and memories that
            made us the Garcia family—so I can learn where we came from and
            keep those stories for whoever comes next.
          </p>
          <div className="hero-actions">
            <Link href="/memories" className="button button-primary">
              Explore our story
            </Link>
            <Link href="/contribute" className="button button-secondary">
              Share a memory
            </Link>
          </div>
          <p className="signature">— Julianne</p>
        </div>

        <div className="hero-keepsake" aria-label="Family memory placeholder">
          <div className="polaroid polaroid-back">
            <div className="placeholder-photo" />
          </div>
          <div className="polaroid polaroid-front">
            <div className="placeholder-photo">
              <span>family photo</span>
            </div>
            <p>Our story is still being written.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FEATURED MEMORIES</p>
            <h2>Stories worth passing down</h2>
          </div>
          <Link href="/memories" className="text-link">
            View all memories →
          </Link>
        </div>
        <div className="memory-grid">
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      </section>

      <section className="timeline-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THROUGH THE YEARS</p>
            <h2>A family measured in moments</h2>
          </div>
        </div>
        <div className="timeline">
          {years.map((year) => (
            <div className="timeline-stop" key={year}>
              <span />
              <strong>{year}</strong>
            </div>
          ))}
        </div>
        <Link href="/timeline" className="button button-secondary">
          Explore the family timeline
        </Link>
      </section>

      <section className="invitation">
        <div>
          <p className="eyebrow">HELP ME LEARN OUR STORY</p>
          <h2>Do you remember something I should know?</h2>
          <p>
            A photograph is only part of a memory. Tell me who was there,
            where it happened, what everyone was laughing about, or the story
            you never want our family to forget.
          </p>
        </div>
        <Link href="/contribute" className="button button-light">
          Add your memory
        </Link>
      </section>
    </>
  );
}
