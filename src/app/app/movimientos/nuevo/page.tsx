import { getAccounts, getCategories, getGoals } from "@/lib/actions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MovimientoForm from "@/components/movimientos/MovimientoForm";

export default async function NuevoMovimientoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch metadata for the form
  const [accounts, categories, goals] = await Promise.all([
    getAccounts(),
    getCategories(),
    getGoals(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-2xl mx-auto">
      <MovimientoForm 
        accounts={accounts} 
        categories={categories} 
        goals={goals} 
      />
    </div>
  );
}
