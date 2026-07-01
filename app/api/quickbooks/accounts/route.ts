// to get income account ids

import { NextResponse } from 'next/server';
import { qboQuery } from '@/lib/quickbooks/api';

export async function GET() {
    try {
        const result = await qboQuery(
            "SELECT * FROM Account WHERE AccountType = 'Income'"
        );

        const accounts = result?.QueryResponse?.Account ?? [];

        return NextResponse.json({
            success: true,
            count: accounts.length,
            accounts: accounts.map((a: any) => ({
                id: a.Id,
                name: a.Name,
                accountType: a.AccountType,
                accountSubType: a.AccountSubType,
                classification: a.Classification,
                active: a.Active,
            })),
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? 'Failed to fetch accounts' },
            { status: 500 }
        );
    }
}