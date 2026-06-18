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

        // 3. Reuse an existing tenant ID if one exists to prevent multi-account mismatch, otherwise generate a unique one
        const allUserAccounts = await db
            .select({ tenantId: corsairAccounts.tenantId })
            .from(corsairAccounts)
            .where(
                or(
                    eq(corsairAccounts.tenantId, session.user.id),
                    like(corsairAccounts.tenantId, `${session.user.id}\\_%`)
                )
            )
            .limit(1);

        const uniqueTenantId = allUserAccounts[0]?.tenantId ?? `${session.user.id}_${Date.now()}`;

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

