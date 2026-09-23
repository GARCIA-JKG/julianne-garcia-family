import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !["admin", "curator"].includes(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await request.json();
    const status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : null;

    if (!status) {
      return NextResponse.json({ error: "Invalid review decision." }, { status: 400 });
    }

    await query(
      `UPDATE memories
       SET status = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now()
       WHERE id = $3 AND status = 'pending'`,
      [status, user.id, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("review failed", error);
    return NextResponse.json({ error: "Could not review memory." }, { status: 500 });
  }
}
