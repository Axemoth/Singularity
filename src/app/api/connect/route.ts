import { generateOAuthUrl } from "corsair/oauth";
import { corsair } from "@/server/corsair";
import { getSession } from "@/server/better-auth/server";
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
        const { url, state } = await generateOAuthUrl(corsair, plugin, {
            tenantId: session.user.id,
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
    } catch (err: any) {
        console.error("Error generating OAuth URL:", err);
        return new NextResponse(`Failed to generate OAuth URL: ${err.message || err}`, { status: 500 });
    }
}
