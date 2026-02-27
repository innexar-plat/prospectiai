import { NextRequest } from "next/server";
import { getOrCreateRequestId, jsonWithRequestId } from "@/lib/request-id";

/**
 * Health endpoint for load balancers and Docker healthchecks.
 * Returns 200 when the app is up. Header x-request-id para rastreabilidade.
 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  return jsonWithRequestId({ status: "ok" }, { requestId });
}
