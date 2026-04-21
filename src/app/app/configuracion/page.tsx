import { getProfile, getCurrentUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import ConfiguracionClient from "@/components/configuracion/ConfiguracionClient";

export default async function ConfiguracionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfile();

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <ConfiguracionClient user={user} profile={profile} />
    </div>
  );
}
