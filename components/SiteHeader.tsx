import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export async function SiteHeader() {
  const user = await getCurrentUser();

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
        {user ? (
          <>
            <Link href="/memories">Memories</Link>
            <Link href="/timeline">Timeline</Link>
            <Link href="/people">People</Link>
            {["admin", "curator"].includes(user.role) && <Link href="/admin">Curate</Link>}
            {["admin", "curator"].includes(user.role) && <Link href="/admin/scans">Scan Inbox</Link>}
            {user.role === "admin" && <Link href="/admin/users">Family Access</Link>}
            {user.role !== "viewer" && (
              <Link href="/contribute" className="nav-cta">Share a Memory</Link>
            )}
            <Link href="/account">Account</Link>
            <LogoutButton />
          </>
        ) : (
          <Link href="/login" className="nav-cta">Family sign in</Link>
        )}
      </nav>
    </header>
  );
}
