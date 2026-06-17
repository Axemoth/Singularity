import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";
import LoginForm from "./login-form";

// Server component - checks session without touching cookies.
// If the user is already authenticated, skip the login page and
// send them straight to their inbox.
export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/inbox");
  }

  return <LoginForm />;
}
