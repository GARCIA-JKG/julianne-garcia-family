import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">YOUR FAMILY ACCOUNT</p>
        <h1>{user.displayName}</h1>
        <p>{user.email} · {user.role}</p>
      </div>

      <div className="auth-keepsake account-card">
        <h2>Change your password</h2>
        <p>Use a password you do not reuse on another website.</p>
        <ChangePasswordForm />
      </div>
    </section>
  );
}
