import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { qboQuery, qboRequest } from '@/lib/quickbooks/api';

const ELIGIBLE = new Set(['Quoted', 'Shortlisted', 'Awarded']);

function esc(value: string) {
    return value.replace(/'/g, "\\'");
}

function numberValue(value: unknown) {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

function estimateMetadataFields(values: { salesperson: string; paymentTerm: string }) {
    // Verified from the existing Make scenario's QuickBooks response:
    // DefinitionId 2 is Payment Terms; DefinitionId 3 is the current legacy
    // salesperson slot. Name is intentionally omitted because QuickBooks uses
    // the definition ID to resolve a transaction custom field.
    return [
        ...(values.paymentTerm.trim()
            ? [{
                DefinitionId: '2',
                Type: 'StringType',
                StringValue: values.paymentTerm.trim(),
            }]
            : []),
        {
            DefinitionId: '3',
            Type: 'StringType',
            StringValue: values.salesperson,
        },
    ];
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

    const created = await qboRequest('/item', {
        method: 'POST',
        body: JSON.stringify({
            Name: name,
            Type: 'NonInventory',
            IncomeAccountRef: {
                value: process.env.QUICKBOOKS_INCOME_ACCOUNT_ID!,
            },
            SalesTaxCodeRef: {
                value: '59',
            },
        }),
    });

    return created.Item;
}

export async function POST(req: NextRequest) {
    try {
        const { clientId, paymentTerm: suppliedPaymentTerm } = await req.json();
        if (!clientId) {
            return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const paymentTerm = String(suppliedPaymentTerm ?? '').trim().slice(0, 200);
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .maybeSingle();
        const actorName = profile?.full_name?.trim() || profile?.email || user.email || 'CRM user';

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

        const subitems = (client.subitems ?? [])
            .filter((s: any) => ELIGIBLE.has((s.status ?? '').trim()))
            .sort((first: any, second: any) => Number(first.position ?? Number.MAX_SAFE_INTEGER) - Number(second.position ?? Number.MAX_SAFE_INTEGER));

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

            // `price` on the CRM board is the line total (Qty × U.P.), not the unit price.
            const qty = numberValue(subitem.qty) || 1;
            const unitPrice = numberValue(subitem.up) || (qty > 0 ? numberValue(subitem.price) / qty : 0);
            const amount = qty * unitPrice;
            const localOverseas = (subitem.local_overseas ?? '').trim().toLowerCase();
            const taxCodeValue =
                localOverseas === 'overseas'
                ? '21'
                : '59';

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
                    Qty: qty,
                    UnitPrice: unitPrice,
                    TaxCodeRef: {
                        value: taxCodeValue,
                    }
                },
            });
        }

        const customFields = estimateMetadataFields({
            salesperson: actorName,
            paymentTerm,
        });
        const estimateRes = await qboRequest('/estimate', {
            method: 'POST',
            body: JSON.stringify({
                CustomerRef: {
                    value: customer.Id,
                    name: customer.DisplayName,
                },
                Line: lines,
                ...(customFields.length
                    ? { CustomField: customFields }
                    : {}),
            }),
        });

        const estimate = estimateRes?.Estimate;

        const { data: generation, error: generationError } = await supabase
            .from('estimate_generations')
            .insert({
                client_id: client.id,
                quickbooks_customer_id: customer.Id,
                quickbooks_estimate_id: estimate?.Id ?? null,
                quickbooks_estimate_doc_number: estimate?.DocNumber ?? null,
            })
            .select('id')
            .single();
        if (generationError) throw generationError;

        const { error: activityError } = await supabase.from('activity_log').insert({
            client_id: client.id,
            subitem_id: null,
            actor_name: actorName,
            action: 'estimate_created',
            field_name: null,
            old_value: null,
            new_value: null,
            subitem_name: null,
            link: null,
            title: 'generated a QuickBooks estimate',
            description: estimate?.DocNumber ? `QuickBooks estimate ${estimate.DocNumber}` : 'QuickBooks estimate generated',
            meta: { kind: 'quickbooks', estimateGenerationId: generation.id, quickbooksEstimateId: estimate?.Id ?? null, docNumber: estimate?.DocNumber ?? null, subitemIds: subitems.map((item: { id: string }) => item.id) },
            created_at: new Date().toISOString(),
        });
        if (activityError) throw activityError;

        return NextResponse.json({
            success: true,
            estimateGenerationId: generation.id,
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
