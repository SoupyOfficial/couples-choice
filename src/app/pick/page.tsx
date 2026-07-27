import { getCurrentUser } from "@/app/actions";
import { redirect } from "next/navigation";
import { PickContent } from "./pick-content";

export default async function PickPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <PickContent userId={user.id} />;
}
