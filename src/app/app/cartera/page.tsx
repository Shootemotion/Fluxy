import { getPosiciones, getPasivos, getAccounts, getCategories } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CarteraClient from "@/components/cartera/CarteraClient";

export default async function CarteraPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [valuationsResult, posiciones, pasivos, accounts, categories] = await Promise.all([
    supabase
      .from("valuaciones")
      .select("*")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false }),
    getPosiciones(),
    getPasivos(),
    getAccounts(),
    getCategories("gasto"),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <CarteraClient
        initialValuations={valuationsResult.data || []}
        initialPosiciones={posiciones}
        initialPasivos={pasivos}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
