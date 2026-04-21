import { getGoals, getAccounts } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ObjetivosClient from "@/components/objetivos/ObjetivosClient";

export default async function ObjetivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [goals, accounts] = await Promise.all([getGoals(), getAccounts()]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <ObjetivosClient initialGoals={goals} accounts={accounts} />
    </div>
  );
}
