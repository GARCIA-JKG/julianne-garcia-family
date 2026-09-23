import { destroyBearerSession } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(request: Request) {
  await destroyBearerSession(request);
  return clientJson({ ok: true });
}
