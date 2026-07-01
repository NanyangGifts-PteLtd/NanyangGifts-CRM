import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { qboQuery, qboRequest } from '@/lib/quickbooks/api';

const ELIGIBLE = new Set(['Quoted', 'Shortlisted', 'Awarded']);

function esc(value: string) {
    return value.replace(/'/g, "\\'");
}

async function getOrCreateCustomer(client: any) {
    const name = (client.company ?? '').trim();
    if (!name) throw new Error('Client name missing');

    const existing = await qboQuery(
        `SELECT * FROM Customer WHERE DisplayName = '${esc(client.company)}'`
    );

    console.log('hi');

    const found = existing?.QueryResponse?.Customer?.[0];
    if (found) return found;

    const created = await qboRequest('/customer', {
        method: 'POST',
        body: JSON.stringify({
            DisplayName: client.company || undefined,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
            BillAddr: client.billing_address ? { Line1: client.billing_address } : undefined,
        }),
    });

    return created.Customer;
}

async function getOrCreateItem(subitem: any) {
    const name = (subitem.name ?? '').trim();
    if (!name) throw new Error('Subitem name missing');

    const existing = await qboQuery(
        `SELECT * FROM Item WHERE Name = '${esc(name)}'`
    );

    const found = existing?.QueryResponse?.Item?.[0];
    if (found) return found;

    const unitPrice = Number(subitem.price || subitem.up || 0);
    const created = await qboRequest('/item', {
        method: 'POST',
        body: JSON.stringify({
            Name: name,
            Type: 'NonInventory',
            IncomeAccountRef: {
                value: process.env.QUICKBOOKS_INCOME_ACCOUNT_ID!,
            },
            SalesTaxCodeRef: '59'
        }),
    });

    return created.Item;
}

export async function POST(req: NextRequest) {
    try {
        const { clientId } = await req.json();
        if (!clientId) {
            return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: client, error } = await supabase
            .from('clients')
            .select(`
        *,
        subitems (*)
        `)
            .eq('id', clientId)
            .single();

        if (error || !client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const subitems = (client.subitems ?? []).filter((s: any) =>
            ELIGIBLE.has((s.status ?? '').trim())
        );

        if (!subitems.length) {
            return NextResponse.json(
                { error: 'No eligible subitems with Quoted/Shortlisted/Awarded status' },
                { status: 400 }
            );
        }

        const customer = await getOrCreateCustomer(client);

        const lines = [];
        for (let i = 0; i < subitems.length; i += 1) {
            const subitem = subitems[i];
            const item = await getOrCreateItem(subitem);

            const qty = Number(subitem.qty || 1);
            const unitPrice = Number(subitem.price || subitem.up || 0);
            const amount = (Number.isFinite(qty) ? qty : 1) * (Number.isFinite(unitPrice) ? unitPrice : 0);

            lines.push({
                LineNum: i + 1,
                Amount: amount,
                Description: subitem.description || subitem.name || 'Unnamed item',
                DetailType: 'SalesItemLineDetail',
                SalesItemLineDetail: {
                    ItemRef: {
                        value: item.Id,
                        name: item.Name,
                    },
                    Qty: Number.isFinite(qty) ? qty : 1,
                    UnitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
                    TaxCodeRef: {
                        value: '59',
                    }
                },
            });
        }

        const estimateRes = await qboRequest('/estimate', {
            method: 'POST',
            body: JSON.stringify({
                CustomerRef: {
                    value: customer.Id,
                    name: customer.DisplayName,
                },
                Line: lines,
            }),
        });

        const estimate = estimateRes?.Estimate;

        await supabase.from('estimate_generations').insert({
            client_id: client.id,
            quickbooks_customer_id: customer.Id,
            quickbooks_estimate_id: estimate?.Id ?? null,
            quickbooks_estimate_doc_number: estimate?.DocNumber ?? null,
        });

        return NextResponse.json({
            success: true,
            estimateId: estimate?.Id ?? null,
            docNumber: estimate?.DocNumber ?? null,
        });
    } catch (error: any) {
        console.error('Generate estimate failed:', error);
        return NextResponse.json(
            { error: error?.message ?? 'Failed to generate estimate' },
            { status: 500 }
        );
    }
}