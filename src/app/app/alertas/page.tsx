import { getAlertas, getAlertRules, getAccounts, getCategories, getGoals } from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import AlertasClient from "@/components/alertas/AlertasClient";

export default async function AlertasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const [alertas, rules, accounts, categories, goals] = await Promise.all([
    getAlertas(),
    getAlertRules(),
    getAccounts(),
    getCategories(),
    getGoals(),
  ]);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <AlertasClient
        initialAlertas={alertas}
        initialRules={rules}
        accounts={accounts}
        categories={categories}
        goals={goals}
      />
    </div>
  );
}
