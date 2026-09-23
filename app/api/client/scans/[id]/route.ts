import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { getScanBatch } from "@/lib/imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  const { id } = await params;
  const batch = await getScanBatch(id);
  if (!batch) return clientJson({ error: "Scan batch not found." }, { status: 404 });

  return clientJson({ batch });
}
