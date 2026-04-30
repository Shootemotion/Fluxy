import { getMovements, getCategories, getAccounts } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MovimientosClient from "@/components/movimientos/MovimientosClient";

export default async function MovimientosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [movements, categories, accounts] = await Promise.all([
    getMovements(500),
    getCategories(),
    getAccounts(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <MovimientosClient initialMovements={movements} categories={categories} accounts={accounts} />
    </div>
  );
}
