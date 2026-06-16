import { NextResponse } from "next/server";

const TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function GET() {
    // Serve cached token if still valid (with 5-min buffer)
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return NextResponse.json({ token: cachedToken });
    }

    const clientId = process.env.ICD_CLIENT_ID;
    const clientSecret = process.env.ICD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "ICD credentials not configured." }, { status: 500 });
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "icdapi_access",
    });

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        return NextResponse.json({ error: `Token fetch failed: ${text}` }, { status: response.status });
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    // Cache for (expires_in - 300) seconds
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return NextResponse.json({ token: cachedToken });
}
