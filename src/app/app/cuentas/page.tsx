import { getAccounts } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CuentasClient from "@/components/cuentas/CuentasClient";

export default async function CuentasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const accounts = await getAccounts();

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <CuentasClient initialAccounts={accounts} />
    </div>
  );
}
