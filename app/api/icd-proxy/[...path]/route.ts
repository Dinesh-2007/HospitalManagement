import { NextRequest, NextResponse } from "next/server";

const ICD_BASE = "https://id.who.int";
const TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.ICD_CLIENT_ID ?? "",
        client_secret: process.env.ICD_CLIENT_SECRET ?? "",
        scope: "icdapi_access",
    });

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
    });

    if (!res.ok) throw new Error(`Token error: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
) {
    try {
        const { path } = await context.params;
        const token = await getToken();
        const icdPath = path.join("/");
        const search = request.nextUrl.search;
        const upstreamUrl = `${ICD_BASE}/${icdPath}${search}`;

        const upstreamRes = await fetch(upstreamUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Accept-Language": "en",
                "API-Version": "v2",
            },
            cache: "no-store",
        });

        const body = await upstreamRes.text();
        return new NextResponse(body, {
            status: upstreamRes.status,
            headers: {
                "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
