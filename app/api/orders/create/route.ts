import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/orders/create
 * Alias for POST /api/orders — used by the offline sync queue so all
 * customer writes go through a single, RLS-safe server route.
 */
export { POST } from "../route";
