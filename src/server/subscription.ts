import DodoPayments from "dodopayments";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const dodoPayments = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode",
});

export async function isPremiumUser(email: string): Promise<boolean> {
  try {
    // 0. Check database for premiumOverride or premium
    const [dbUser] = await db
      .select({ 
        premiumOverride: user.premiumOverride,
        premium: user.premium,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (dbUser?.premiumOverride || dbUser?.premium) {
      return true;
    }

    // 1. Get customer list by email
    const customers = await dodoPayments.customers.list({ email });
    if (!customers || !customers.items || customers.items.length === 0) {
      return false;
    }

    // 2. Check each customer record for active subscriptions
    for (const customer of customers.items) {
      const subscriptions = await dodoPayments.subscriptions.list({
        customer_id: customer.customer_id,
        status: "active",
      });

      if (subscriptions && subscriptions.items && subscriptions.items.length > 0) {
        // Cache the active subscription status in the DB
        await db.update(user).set({ premium: true }).where(eq(user.email, email));
        return true;
      }
    }

    // No active subscriptions found — clear the cached premium flag
    await db.update(user).set({ premium: false }).where(eq(user.email, email));
  } catch (err) {
    console.error("[Subscription] Failed to verify subscription status via Dodo Payments:", err);
  }
  return false;
}
