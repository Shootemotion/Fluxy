import { getRecurrentes, getAccounts, getCategories } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RecurrentesClient from "@/components/recurrentes/RecurrentesClient";

export default async function RecurrentesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [recurrentes, accounts, categories] = await Promise.all([
    getRecurrentes(),
    getAccounts(),
    getCategories(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <RecurrentesClient
        initialRecurrentes={recurrentes}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
