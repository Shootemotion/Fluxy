import { getRecurrentes, getAccounts, getCategories, getMovements } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RecurrentesClient from "@/components/recurrentes/RecurrentesClient";

export default async function RecurrentesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [recurrentes, accounts, categories, movements] = await Promise.all([
    getRecurrentes(),
    getAccounts(),
    getCategories(),
    getMovements(1000), // Fetch up to 1000 movements to match past periods
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <RecurrentesClient
        initialRecurrentes={recurrentes}
        accounts={accounts}
        categories={categories}
        movements={movements}
      />
    </div>
  );
}
