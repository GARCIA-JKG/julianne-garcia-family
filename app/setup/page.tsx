import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { hasUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasUsers()) redirect("/login");

  return (
    <section className="auth-shell">
      <div className="auth-keepsake">
        <p className="eyebrow">FIRST-TIME SETUP</p>
        <h1>Start Julianne&apos;s family archive.</h1>
        <p>
          Create the first administrator account. From here, you&apos;ll invite family,
          review contributions, and protect the archive.
        </p>
        <AuthForm mode="setup" />
        <p className="form-help">
          Already set up? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
