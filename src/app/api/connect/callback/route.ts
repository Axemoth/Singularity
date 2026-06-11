import { processOAuthCallback } from "corsair/oauth";
import { corsair } from "@/server/corsair";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
        const response = NextResponse.redirect(new URL("/settings?connected=" + result.plugin, process.env.APP_URL));
        response.cookies.delete("oauth_state");
        return response;
    } catch (err: any) {
        console.error("OAuth callback exchange failed:", err);
        const response = new NextResponse(`OAuth failed: ${err.message || err}`, { status: 500 });
        response.cookies.delete("oauth_state");
        return response;
    }
}
