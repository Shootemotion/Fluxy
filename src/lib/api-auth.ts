import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Guard for the /api routes.
 *
 * The middleware only protects /app, so without this every route here is an
 * open proxy to the upstream providers (Yahoo Finance, ArgentinaDatos) that
 * anyone could hammer on our quota and our IP.
 *
 * Returns null when the caller is signed in, or the 401 response to return.
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
