import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (dbUser?.role !== "admin") {
    redirect("/inbox");
  }

  return (
    <div className="bg-bg-base flex h-screen overflow-hidden">
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
