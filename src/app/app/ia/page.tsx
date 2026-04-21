import { getAccounts, getGoals, getCategories } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IAClient from "@/components/ia/IAClient";

export default async function IAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [accounts, goals, categories] = await Promise.all([
    getAccounts(),
    getGoals(),
    getCategories(),
  ]);

  return <IAClient accounts={accounts} goals={goals} categories={categories} />;
}
