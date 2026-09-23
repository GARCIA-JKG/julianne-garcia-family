import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { CreateFamilyUser } from "@/components/CreateFamilyUser";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole(["admin"]);

  const users = await query<{
    id: string;
    display_name: string;
    email: string;
    role: string;
    active: boolean;
  }>(
    `SELECT id, display_name, email, role, active
     FROM users
     ORDER BY display_name`
  );

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">FAMILY ACCESS</p>
        <h1>Family accounts</h1>
        <p>Create private accounts for relatives who should be able to browse or contribute.</p>
      </div>

      <CreateFamilyUser />

      <div className="family-user-list">
        {users.rows.map((user) => (
          <div className="family-user-row" key={user.id}>
            <div>
              <strong>{user.display_name}</strong>
              <span>{user.email}</span>
            </div>
            <span className="role-pill">{user.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
