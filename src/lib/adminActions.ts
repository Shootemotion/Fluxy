"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const adminEmail = "bmclerif@gmail.com";

export async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== adminEmail) {
    return false;
  }
  return true;
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase Service Key");
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function getAdminStats() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const supabase = getAdminSupabase();

  const [
    { data: users, error: usersErr },
    { count: totalMovements },
    { count: totalPasivos },
    { count: totalObjetivos },
    { count: totalRecurrentes }
  ] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from("movimientos").select("*", { count: "exact", head: true }),
    supabase.from("pasivos").select("*", { count: "exact", head: true }),
    supabase.from("objetivos").select("*", { count: "exact", head: true }),
    supabase.from("recurrentes").select("*", { count: "exact", head: true })
  ]);

  if (usersErr) throw usersErr;

  return {
    totalUsers: users?.users?.length || 0,
    totalMovements: totalMovements || 0,
    totalPasivos: totalPasivos || 0,
    totalObjetivos: totalObjetivos || 0,
    totalRecurrentes: totalRecurrentes || 0,
    recentUsers: users?.users?.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10) || []
  };
}
