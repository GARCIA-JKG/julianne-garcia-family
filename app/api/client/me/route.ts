import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function GET(request: Request) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  return clientJson({ user });
}
