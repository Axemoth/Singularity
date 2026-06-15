import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";
import LandingPage from "./_components/landing/landing-page";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/inbox");
  }

  return <LandingPage />;
}
