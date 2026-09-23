import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <section className="auth-shell">
      <div className="auth-keepsake">
        <p className="eyebrow">PRIVATE FAMILY ARCHIVE</p>
        <h1>Welcome back.</h1>
        <p>Sign in to explore and help preserve the Garcia family story.</p>
        <AuthForm mode="login" />
        <p className="form-help">
          First time running the archive? <Link href="/setup">Complete setup</Link>
        </p>
      </div>
    </section>
  );
}
