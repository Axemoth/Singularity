import { processOAuthCallback } from "corsair/oauth";
import { corsair } from "@/server/corsair";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
        const response = new NextResponse("Missing code or state.", { status: 400 });
        response.cookies.delete("oauth_state");
        return response;
    }

    const storedState = request.cookies.get("oauth_state")?.value;
    if (!storedState || storedState !== state) {
        const response = new NextResponse("Invalid state.", { status: 400 });
        response.cookies.delete("oauth_state");
        return response;
    }

    const redirectUri = `${process.env.APP_URL}/api/connect/callback`;

    try {
        const result = await processOAuthCallback(corsair, { code, state, redirectUri });
        const { tenantId, plugin } = result;

        // Fetch user email address and save it to corsair_accounts.config
        try {
            const tenant = corsair.withTenant(tenantId);
            let emailAddress = "";

            if (plugin === "gmail") {
                const accessToken = await tenant.gmail.keys.get_access_token();
                if (accessToken) {
                    const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    });
                    if (res.ok) {
                        const profile = (await res.json()) as { emailAddress?: string };
                        emailAddress = profile.emailAddress ?? "";
                    } else {
                        console.error("[OAuth Callback] Gmail profile fetch failed:", await res.text());
                    }
                }
            } else if (plugin === "googlecalendar") {
                const accessToken = await tenant.googlecalendar.keys.get_access_token();
                if (accessToken) {
                    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    });
                    if (res.ok) {
                        const calendar = (await res.json()) as { id?: string };
                        emailAddress = calendar.id ?? "";
                    } else {
                        console.error("[OAuth Callback] Calendar primary fetch failed:", await res.text());
                    }
                }
            }

            if (emailAddress) {
                // Validate using zod to ensure it's a valid email format
                const emailSchema = z.string().email();
                const parseResult = emailSchema.safeParse(emailAddress);
                if (!parseResult.success) {
                    console.error("[OAuth Callback] Invalid email address format:", emailAddress);
                    throw new Error("Invalid email address format received from provider");
                }
                const validatedEmail = parseResult.data;

                const { db } = await import("@/server/db");
                const { corsairAccounts, corsairIntegrations } = await import("@/server/db/schema");
                const { eq, and } = await import("drizzle-orm");

                // Get the integration ID
                const integration = await db.query.corsairIntegrations.findFirst({
                    where: eq(corsairIntegrations.name, plugin)
                });

                if (integration) {
                    await db.update(corsairAccounts)
                        .set({
                            emailAddress: validatedEmail
                        })
                        .where(
                            and(
                                eq(corsairAccounts.tenantId, tenantId),
                                eq(corsairAccounts.integrationId, integration.id)
                            )
                        );
                    console.info(`[OAuth Callback] Cached emailAddress "${validatedEmail}" for tenant "${tenantId}", plugin "${plugin}"`);
                }
            }
        } catch (profileErr) {
            console.error(`[OAuth Callback] Failed to fetch or cache profile for ${plugin}:`, profileErr);
            // Non-blocking error, do not fail the callback redirect
        }

        const response = NextResponse.redirect(new URL("/settings?connected=" + plugin, process.env.APP_URL));
        response.cookies.delete("oauth_state");
        return response;
    } catch (err: any) {
        console.error("OAuth callback exchange failed:", err);
        const response = new NextResponse(`OAuth failed: ${err.message || err}`, { status: 500 });
        response.cookies.delete("oauth_state");
        return response;
    }
}
