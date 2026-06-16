import { createAuthClient } from "better-auth/react";
import { dodopaymentsClient } from "@dodopayments/better-auth/client";

export const authClient = createAuthClient({
  plugins: [
    dodopaymentsClient(),
  ],
});

export type Session = typeof authClient.$Infer.Session;
