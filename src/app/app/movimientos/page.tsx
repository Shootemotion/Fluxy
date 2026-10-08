import { getMovements, getMovementsCount, getCategories, getAccounts } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MovimientosClient from "@/components/movimientos/MovimientosClient";

export default async function MovimientosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const PAGE_SIZE = 500;

  const [movements, totalMovements, categories, accounts] = await Promise.all([
    getMovements(PAGE_SIZE),
    getMovementsCount(),
    getCategories(),
    getAccounts(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <MovimientosClient
        initialMovements={movements}
        totalMovements={totalMovements}
        pageSize={PAGE_SIZE}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
