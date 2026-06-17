import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import { dodopayments, checkout, portal, webhooks, usage } from "@dodopayments/better-auth";
import DodoPayments from "dodopayments";

import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const dodoPayments = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode",
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    dodopayments({
      client: dodoPayments,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "pdt_0NhC6bRf99ugDrKx11htS",
              slug: "premium-plan",
            },
          ],
          successUrl: "/settings?payment=success",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "",
          onPayload: async (payload) => {
            console.log("Received webhook:", payload.type);
          },
          onSubscriptionActive: async (payload) => {
            console.log("[Webhook] Subscription active:", payload.data?.customer?.email);
            const email = payload.data?.customer?.email;
            if (email) {
              await db.update(user).set({ premium: true }).where(eq(user.email, email));
            }
          },
          onSubscriptionRenewed: async (payload) => {
            console.log("[Webhook] Subscription renewed:", payload.data?.customer?.email);
            const email = payload.data?.customer?.email;
            if (email) {
              await db.update(user).set({ premium: true }).where(eq(user.email, email));
            }
          },
          onSubscriptionExpired: async (payload) => {
            console.log("[Webhook] Subscription expired:", payload.data?.customer?.email);
            const email = payload.data?.customer?.email;
            if (email) {
              await db.update(user).set({ premium: false }).where(eq(user.email, email));
            }
          },
          onPaymentSucceeded: async (payload) => {
            console.log("[Webhook] Payment succeeded:", payload.data?.customer?.email);
            const email = payload.data?.customer?.email;
            if (email) {
              await db.update(user).set({ premium: true }).where(eq(user.email, email));
            }
          },
        }),
        usage(),
      ],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
