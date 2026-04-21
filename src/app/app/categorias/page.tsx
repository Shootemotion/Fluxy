import { getCategories } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CategoriasClient from "@/components/categorias/CategoriasClient";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const categories = await getCategories();

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-3xl">
      <CategoriasClient initialCategories={categories} />
    </div>
  );
}
