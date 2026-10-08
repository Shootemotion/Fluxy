import { getAccounts, getCategories, getReglasCategorizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ImportarClient from "@/components/importar/ImportarClient";

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [accounts, categories, reglas] = await Promise.all([
    getAccounts(),
    getCategories(),
    getReglasCategorizacion(),
  ]);

  return (
    <div className="w-full">
      <ImportarClient accounts={accounts} categories={categories} reglas={reglas} />
    </div>
  );
}
