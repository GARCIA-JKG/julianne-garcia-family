import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { getPersonProfile } from "@/lib/people";

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

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const person = await getPersonProfile(id);

  if (!person) {
    return clientJson({ error: "Person not found." }, { status: 404 });
  }

  return clientJson({ person });
}
