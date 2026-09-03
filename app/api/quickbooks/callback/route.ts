import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');

    if (!code || !realmId) {
        return NextResponse.json({ error: 'Missing code or realmId' }, { status: 400 });
    }

    const basic = Buffer.from(
        `${process.env.QUICKBOOKS_CLIENT_ID!}:${process.env.QUICKBOOKS_CLIENT_SECRET!}`
    ).toString('base64');

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
        }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
        return NextResponse.json({ error: tokenJson }, { status: 500 });
    }

    const supabase = supabaseAdmin;
    const now = Date.now();
    const accessExpiresAt = new Date(now + tokenJson.expires_in * 1000).toISOString();

    await supabase.from('quickbooks_connections').upsert({
        realm_id: realmId,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        access_token_expires_at: accessExpiresAt,
        environment: 'production',
        updated_at: new Date().toISOString(),
    });
    console.log('QB callback hit');
    console.log('code exists:', !!code);
    console.log('realmId:', realmId);
    console.log('token response ok:', tokenRes.ok);
    console.log('tokenJson:', tokenJson);

    return NextResponse.json({
        success: true,
        realmId,
        accessTokenSaved: !!tokenJson.access_token,
        refreshTokenSaved: !!tokenJson.refresh_token,
    });
}
