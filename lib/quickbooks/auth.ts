import { createClient } from '@/lib/supabase/server';

export async function getValidQuickBooksConnection() {
    const supabase = await createClient();
    

    const { data: connection, error } = await supabase
        .from('quickbooks_connections')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !connection) {
        throw new Error('QuickBooks not connected');
    }
    console.log('Using QB connection:', {
        id: connection.id,
        realm_id: connection.realm_id,
        environment: connection.environment,
        updated_at: connection.updated_at,
    });

    const expiresAt = new Date(connection.access_token_expires_at).getTime();
    const needsRefresh = Date.now() > expiresAt - 5 * 60 * 1000;

    if (!needsRefresh) return connection;

    const basic = Buffer.from(
        `${process.env.QUICKBOOKS_CLIENT_ID!}:${process.env.QUICKBOOKS_CLIENT_SECRET!}`
    ).toString('base64');

    const refreshRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: connection.refresh_token,
        }),
    });

    const refreshJson = await refreshRes.json();

    if (!refreshRes.ok) {
        throw new Error(`QuickBooks refresh failed: ${JSON.stringify(refreshJson)}`);
    }

    const updated = {
        ...connection,
        access_token: refreshJson.access_token,
        refresh_token: refreshJson.refresh_token,
        access_token_expires_at: new Date(Date.now() + refreshJson.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
    };

    await supabase
        .from('quickbooks_connections')
        .update({
            access_token: updated.access_token,
            refresh_token: updated.refresh_token,
            access_token_expires_at: updated.access_token_expires_at,
            updated_at: updated.updated_at,
        })
        .eq('id', connection.id);

    return updated;
}