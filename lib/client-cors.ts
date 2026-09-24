import { NextResponse } from "next/server";

const DEFAULT_CLIENT_ORIGIN = "https://garcia-jkg.github.io";

export function clientOrigin() {
  return process.env.PUBLIC_CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN;
}

export function withClientCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", clientOrigin());
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Vary", "Origin");
  return response;
}

export function clientJson(
  body: unknown,
  init?: ResponseInit
) {
  return withClientCors(NextResponse.json(body, init));
}

export function clientOptions() {
  return withClientCors(new NextResponse(null, { status: 204 }));
}
