import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/inbox");
  } else {
    redirect("/login");
  }
}
