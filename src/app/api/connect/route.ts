import { generateOAuthUrl } from "corsair/oauth";
import { corsair } from "@/server/corsair";
import { getSession } from "@/server/better-auth/server";
import { isPremiumUser } from "@/server/subscription";
import { db } from "@/server/db";
import { corsairAccounts, corsairIntegrations } from "@/server/db/schema";
import { eq, and, or, like } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const plugin = new URL(request.url).searchParams.get("plugin");
    if (plugin !== "gmail" && plugin !== "googlecalendar") {
        return new NextResponse("Invalid plugin parameter", { status: 400 });
    }

    // Set fallback redirect URI using process.env.APP_URL
    const redirectUri = `${process.env.APP_URL}/api/connect/callback`;

    try {
        // 1. Determine connection limit based on user subscription
        const isPremium = await isPremiumUser(session.user.email);
        const limit = isPremium ? 3 : 1;

        // 2. Query existing connections for this user and integration
        const existingAccounts = await db
            .select({ id: corsairAccounts.id })
            .from(corsairAccounts)
            .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
            .where(
                and(
                    or(
                        eq(corsairAccounts.tenantId, session.user.id),
                        like(corsairAccounts.tenantId, `${session.user.id}\\_%`)
                    ),
                    eq(corsairIntegrations.name, plugin)
                )
            );

        if (existingAccounts.length >= limit) {
            return NextResponse.redirect(new URL(`/settings?error=limit_reached&plugin=${plugin}`, process.env.APP_URL));
        }

        // 3. Find a tenant ID to use
        // We want to group Gmail and Calendar under the same tenant ID if possible.
        // But if a tenant ID already has the target plugin connected, we must use a new tenant ID to support multiple accounts of the same type.
        const userAccounts = await db
            .select({ 
                tenantId: corsairAccounts.tenantId,
                integrationName: corsairIntegrations.name
            })
            .from(corsairAccounts)
            .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
            .where(
                or(
                    eq(corsairAccounts.tenantId, session.user.id),
                    like(corsairAccounts.tenantId, `${session.user.id}\\_%`)
                )
            );

        // Group integration names by tenantId
        const tenantMap: Record<string, string[]> = {};
        for (const acc of userAccounts) {
            const list = tenantMap[acc.tenantId] ?? [];
            list.push(acc.integrationName);
            tenantMap[acc.tenantId] = list;
        }

        // Find a tenant ID that does NOT have the target plugin connected yet
        let uniqueTenantId = "";
        for (const [tId, plugins] of Object.entries(tenantMap)) {
            if (!plugins.includes(plugin)) {
                uniqueTenantId = tId;
                break;
            }
        }

        // If no existing tenant ID is suitable, generate a new one
        if (!uniqueTenantId) {
            // Default to session.user.id for the very first connection, otherwise use a timestamped suffix
            if (userAccounts.length === 0) {
                uniqueTenantId = session.user.id;
            } else {
                uniqueTenantId = `${session.user.id}_${Date.now()}`;
            }
        }

        const { url, state } = await generateOAuthUrl(corsair, plugin, {
            tenantId: uniqueTenantId,
            redirectUri,
        });

        const response = NextResponse.redirect(url);
        response.cookies.set("oauth_state", state, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 10,
        });
        return response;
    } catch (err) {
        console.error("Error generating OAuth URL:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return new NextResponse(`Failed to generate OAuth URL: ${errorMessage}`, { status: 500 });
    }
}

