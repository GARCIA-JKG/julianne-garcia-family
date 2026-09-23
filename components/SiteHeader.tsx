import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">JG</span>
        <span>
          <strong>Julianne&apos;s Garcia Family</strong>
          <small>Our memories. Our stories.</small>
        </span>
      </Link>

      <nav aria-label="Primary navigation">
        <Link href="/memories">Memories</Link>
        <Link href="/timeline">Timeline</Link>
        <Link href="/people">People</Link>
        <Link href="/contribute" className="nav-cta">
          Share a Memory
        </Link>
      </nav>
    </header>
  );
}
