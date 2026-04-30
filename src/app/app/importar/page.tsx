import { getAccounts, getCategories } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ImportarClient from "@/components/importar/ImportarClient";

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  return (
    <div className="w-full">
      <ImportarClient accounts={accounts} categories={categories} />
    </div>
  );
}
