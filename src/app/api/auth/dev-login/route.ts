import { auth } from "@/server/better-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Forbidden in production", { status: 403 });
  }

  const email = "dev@example.com";
  const password = "password123";
  const name = "Dev User";

  try {
    // 1. Try to register the developer user
    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
      });
      console.log(`[Dev Login] Registered new dev user: ${email}`);
    } catch (e) {
      // User might already exist, ignore this error
      console.log("[Dev Login] User register skipped (already exists or failed)");
    }

    // 2. Log in the dev user and set the session cookies
    const signInRes = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: request.headers,
      asResponse: true,
    });

    console.log("[Dev Login] Dev user signed in successfully");
    return signInRes;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Dev Login] Error in dev login endpoint:", err);
    return new NextResponse(`Dev login failed: ${errMsg}`, { status: 500 });
  }
}
