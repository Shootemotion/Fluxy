import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUncategorizedMovements, getCategories } from "@/lib/actions";
import PulirClient from "@/components/pulir/PulirClient";

export default async function PulirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [movements, categories] = await Promise.all([
    getUncategorizedMovements(),
    getCategories(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Pulir movimientos</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
          Clasificá los movimientos sin categoría de a uno para mantener todo ordenado
        </p>
      </div>
      <PulirClient movements={movements} categories={categories} />
    </div>
  );
}
