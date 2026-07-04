import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.warn("[CSP Violation]", JSON.stringify(body, null, 2));
  } catch (err) {
    console.warn("[CSP Violation] failed to parse body", err);
  }
  return new Response(null, { status: 204 });
}
