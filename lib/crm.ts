// fetches clients with nested subitems
// maps db rows to client
// maps client/subitem updates back into db column names
// maps & fetches activity log
// exposes crud functions

import { createClient } from '@/lib/supabase/client';
import type { TimelineRow, Client, Subitem, ActivityEntry } from '@/app/types';
import { addClientAssignee } from './assignments';


const supabase = createClient();

const CLIENT_LOG_IGNORE_FIELDS = new Set<keyof Client>([
    'expanded',
    'activityLog',
    'color',
    'subitems',
    'customFields'
]);

const SUBITEM_LOG_IGNORE_FIELDS = new Set<keyof Subitem>([
    'showTimeline',
    'showPayments',
    'showSample',
    'customFields'
]);




export type RoundRobinQueueRow = {
    user_id: string;
    full_name: string | null;
    email: string | null;
    position: number;
    is_active: boolean;
    is_current: boolean;
}

export async function getSalesRoundRobinQueue() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_sales_round_robin_queue');

    if (error) throw error;
    return (data ?? []) as RoundRobinQueueRow[];
}

export async function getNextSalesAssignee() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_next_sales_assignee');

    if (error) throw error;
    return (data?.[0] ?? null) as { user_id: string; position: number } | null;
}

export async function swapSalesRoundRobinFunctions(firstUserId: string, secondUserId: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc('swap_sales_round_robin_positions', {
        first_user_id: firstUserId,
        second_user_id: secondUserId,
    });

    if (error) throw error;
}

export async function setSalesRoundRobinActive(userId: string, isActive: boolean) {
    const supabase = createClient();
    const { error } = await supabase
        .from('sales_round_robin_pool')
        .update({ is_active: isActive })
        .eq('user_id', userId);

    if (error) throw error;
}
type Subitems = {
    id: string;
    client_id: string;
    name: string | null;
    people: string | null;
    status: string | null;
    local_overseas: string | null;
    qty: string | null;
    description: string | null;
    remarks: string | null;
    shipper: string | null;
    supplier: string | null;
    cost: string | null;
    manpower: string | null;
    manpower_rmb: string | null,
    ls: string | null;
    os: string | null;
    currency: string | null;
    c_sgd: string | null;
    tc: string | null;
    uc: string | null;
    tc_sgd: string | null;
    price: string | null;
    up: string | null;
    num_of_cartons: string | null;
    cn_tracking: string | null;
    sg_tracking: string | null;
    pl: string | null;
    sl: string | null;
    owner: string | null;
    payment: string | null;
    payment_status: string | null;
    total_uc: string | null;
    ls_rmb: string | null;
    total_c: string | null;
    mode_of_payment: string | null;
    order_number: string | null;
    quantity_produced: string | null;
    sample: string | null;
    qty_for: string | null;
    payment_amount: string | null;
    difference: string | null;
    payment_remarks: string | null;
    timeline_rows: any[] | null;
    show_timeline: boolean | null;
    show_payments: boolean | null;
    show_sample: boolean | null;
    sample_rows: any[] | null;
    sample_order_status: string | null;
    sample_status: string | null;
    sample_type: string | null;
    custom_fields?: Record<string, string>;
    shipper_id: string | null;
};

type Clients = {
    id: string;
    name: string | null;
    people: string | null;
    reply_status: string | null;
    follow_up: string | null;
    status: string | null;
    channel: string | null;
    importance: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    requirements: string | null;
    qty: string | null;
    nbd: string | null;
    total_price: string | null;
    company_address: string | null;
    billing_address: string | null;
    date_created: string | null;
    group_id: string;
    expanded: boolean | null;
    color: string | null;
    activity_log?: ActivityLogRow[] | null;
    subitems?: Subitems[];
    custom_fields?: Record<string, string>;
};

type ActivityLogRow = {
    id: string;
    client_id: string;
    subitem_id: string | null;
    actor_name: string | null;
    action: string;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    subitem_name: string | null;
    created_at: string;
    link: string | null;
    title: string | null;
    description: string | null;
    meta: Record<string, any> | null;
};

const TIMELINE_LOG_FIELDS: Array<keyof TimelineRow> = [
    'person',
    'remarks',
    'subProgress',
    'timelineStart',
    'timelineEnd',
    'duration',
    'dependency'
]
function isEqualForLog(a: unknown, b: unknown) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function formatValueForLog(value: unknown): unknown {
    if (value == null) return null;

    if (Array.isArray(value)) {
        return value;
    }

    return value;
}
async function logTimelineRowDiffs(params: {
    clientId: string;
    subitemId: string;
    subitemName: string;
    oldRows: TimelineRow[];
    newRows: TimelineRow[];
}) {
    const oldMap = new Map(params.oldRows.map((row) => [row.id, row]));
    const newMap = new Map(params.newRows.map((row) => [row.id, row]));

    for (const [rowId, newRow] of newMap.entries()) {
        const oldRow = oldMap.get(rowId);

        if (!oldRow) {
            await insertActivityLog({
                clientId: params.clientId,
                subitemId: params.subitemId,
                subitemName: params.subitemName,
                action: 'subitem_field_changed',
                fieldName: `timeline row ${newRow.name ?? rowId} added`,
                oldValue: null,
                newValue: newRow,
            });
            continue;
        }

        for (const field of TIMELINE_LOG_FIELDS) {
            const oldValue = oldRow[field] ?? '';
            const newValue = newRow[field] ?? '';

            if (isEqualForLog(oldValue, newValue)) continue;

            await insertActivityLog({
                clientId: params.clientId,
                subitemId: params.subitemId,
                subitemName: params.subitemName,
                action: 'subitem_field_changed',
                fieldName: `timeline: ${newRow.name ?? rowId}:${String(field)}`,
                oldValue,
                newValue
            });
        }
    }
    for (const [rowId, oldRow] of oldMap.entries()) {
        if (newMap.has(rowId)) continue;

        await insertActivityLog({
            clientId: params.clientId,
            subitemId: params.subitemId,
            subitemName: params.subitemName,
            action: 'subitem_field_changed',
            fieldName: `timeline row ${oldRow.name ?? rowId} removed`,
            oldValue: oldRow,
            newValue: null,
        });
    }
}


function mapActivityEntry(row: ActivityLogRow): ActivityEntry {
    return {
        id: row.id,
        actorName: row.actor_name ?? 'Unknown user',
        action: row.action as ActivityEntry['action'],
        fieldName: row.field_name ?? '',
        oldValue: row.old_value ?? '',
        newValue: row.new_value ?? '',
        subitemId: row.subitem_id ?? undefined,
        subitemName: row.subitem_name ?? '',
        createdAt: row.created_at,
        link: row.link ?? null,
        title: row.title ?? null,
        description: row.description ?? null,
        meta: row.meta ?? null,
    };
}
function mapSubitems(row: Subitems): Subitem {
    return {
        id: row.id,
        name: row.name ?? '',
        people: row.people ?? '',
        status: row.status ?? '',
        localOverseas: row.local_overseas ?? 'Local',
        qty: row.qty ?? '',
        description: row.description ?? '',
        remarks: row.remarks ?? '',
        shipper: row.shipper ?? '',
        supplier: row.supplier ?? '',
        cost: row.cost ?? '',
        manpower: row.manpower ?? '',
        manpowerRmb: row.manpower_rmb ?? '',
        ls: row.ls ?? '',
        os: row.os ?? '',
        currency: row.currency ?? '',
        cSgd: row.c_sgd ?? '',
        tc: row.tc ?? '',
        uc: row.uc ?? '',
        tcSgd: row.tc_sgd ?? '',
        price: row.price ?? '',
        up: row.up ?? '',
        numOfCartons: row.num_of_cartons ?? '',
        cnTracking: row.cn_tracking ?? '',
        sgTracking: row.sg_tracking ?? '',
        pl: row.pl ?? '',
        sl: row.sl ?? '',
        owner: row.owner ?? '',
        payment: row.payment ?? '',
        paymentStatus: row.payment_status ?? '',
        totalUc: row.total_uc ?? '',
        lsRmb: row.ls_rmb ?? '',
        totalC: row.total_c ?? '',
        modeOfPayment: row.mode_of_payment ?? '',
        orderNumber: row.order_number ?? '',
        quantityProduced: row.quantity_produced ?? '',
        sample: row.sample ?? '',
        qtyFor: row.qty_for ?? '',
        paymentAmount: row.payment_amount ?? '',
        difference: row.difference ?? '',
        paymentRemarks: row.payment_remarks ?? '',
        timelineRows: row.timeline_rows ?? [],
        showTimeline: row.show_timeline ?? false,
        showPayments: row.show_payments ?? false,
        showSample: row.show_sample ?? false,
        sampleRows: row.sample_rows ?? [],
        sampleOrderStatus: row.sample_order_status ?? '',
        sampleStatus: row.sample_status ?? '',
        sampleType: row.sample_type ?? '',
        customFields: row.custom_fields ?? {},
        shipperId: row.shipper_id ?? null

    };
}

function mapClients(row: Clients): Client {
    return {
        id: row.id,
        name: row.name ?? '',
        people: row.people ?? '',
        replyStatus: row.reply_status ?? '',
        followUp: row.follow_up ?? '',
        status: (row.status as Client['status']) ?? 'New Lead',
        channel: row.channel ?? '',
        importance: row.importance ?? '',
        company: row.company ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        requirements: row.requirements ?? '',
        nbd: row.nbd ?? '',
        totalPrice: row.total_price ?? '',
        companyAddress: row.company_address ?? '',
        billingAddress: row.billing_address ?? '',
        dateCreated: row.date_created ?? '',
        groupId: row.group_id ?? null,
        expanded: row.expanded ?? false,
        color: row.color ?? '#7BCBD5',
        activityLog: (row.activity_log ?? []).map(mapActivityEntry),
        subitems: (row.subitems ?? []).map(mapSubitems),
        customFields: row.custom_fields ?? {},

    };
}

async function insertActivityLog(params: {
    clientId: string;
    subitemId?: string | null;
    action: 'field_changed' | 'subitem_added' | 'subitem_deleted' | 'subitem_field_changed' | 'ocf_created';
    fieldName?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    subitemName?: string | null;
    link?: string | null;
    title?: string | null;
    description?: string | null;
    meta?: Record<string, any> | null;
}) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const actorEmail = user?.email ?? 'Unknown user';

    const { data, error } = await supabase
        .from('activity_log')
        .insert({
            client_id: params.clientId,
            subitem_id: params.subitemId ?? null,
            actor_name: actorEmail,
            action: params.action,
            field_name: params.fieldName ?? null,
            old_value: params.oldValue ?? null,
            new_value: params.newValue ?? null,
            subitem_name: params.subitemName ?? null,
            link: params.link ?? null,
            title: params.title ?? null,
            description: params.description ?? null,
            meta: params.meta ?? null,
            created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    if (error) {
        console.error('insertActivityLog error:', error);
        throw error;
    }
    return data;
}

export async function logOcfCreated(params: {
    clientId: string;
    ocfId: string;
    title?: string;
    description?: string;
}) {
    return insertActivityLog({
        clientId: params.clientId,
        action: 'ocf_created',
        title: 'generated an Order Confirmation Form',
        link: `/order-confirmations/${params.ocfId}`,
        meta: { ocfId: params.ocfId },
    });
}


export async function fetchClientsWithSubitems() {
    const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
    *,
    subitems (*),
    client_assignees (
        client_id,
        user_id,
        assigned_by,
        assigned_at,
        profiles!client_assignees_user_id_fkey (
        id,
        full_name,
        email,
        avatar_url
        )
    )
    `)
        .order('date_created', { ascending: true });

    if (clientsError) {
        console.error('fetchClientsWithSubitems clients error:', clientsError);
        throw clientsError;
    }

    const { data: activityData, error: activityError } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false });

    if (activityError) {
        console.error('fetchClientsWithSubitems activity error:', activityError);
        throw activityError;
    }

    const activityByClientId = new Map<string, ActivityLogRow[]>();

    for (const row of activityData ?? []) {
        const list = activityByClientId.get(row.client_id) ?? [];
        list.push(row as ActivityLogRow);
        activityByClientId.set(row.client_id, list);
    }

    return (clientsData ?? []).map((row) =>
        mapClients({
            ...(row as Clients),
            activity_log: activityByClientId.get((row as Clients).id) ?? [],
        })
    );
}

export async function createClientRow(currentUserId?: string | null, groupId?: string | null) {
    const singaporeDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());

    const { data, error } = await supabase
        .from('clients')
        .insert({
            name: 'New Client',
            people: '',
            reply_status: '',
            follow_up: '',
            status: 'New Lead',
            channel: '',
            importance: '',
            company: '',
            email: '',
            phone: '',
            requirements: '',
            nbd: '',
            total_price: '',
            company_address: '',
            billing_address: '',
            date_created: singaporeDate,
            group_id: groupId ?? null,
            expanded: true,
            color: '#7BCBD5',
            activity_log: [],
            custom_fields: {}
        })
        .select('*')
        .single();

    if (error) throw error;

    const nextAssignee = await getNextSalesAssignee();

    if (nextAssignee?.user_id) {
        await addClientAssignee(data.id, nextAssignee.user_id, currentUserId);
    }
    return data;
}

export async function updateClientRow(clientId: string, updates: Partial<Client> & { customFields?: Record<string, string>; }) {
    const { data: existing, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

    if (fetchError) throw fetchError;

    const mapped = {
        ...updates,
        group_id: updates.groupId,
    };
    delete mapped.groupId;

    const payload = {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.people !== undefined ? { people: updates.people } : {}),
        ...(updates.replyStatus !== undefined ? { reply_status: updates.replyStatus } : {}),
        ...(updates.followUp !== undefined ? { follow_up: updates.followUp } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.channel !== undefined ? { channel: updates.channel } : {}),
        ...(updates.importance !== undefined ? { importance: updates.importance } : {}),
        ...(updates.company !== undefined ? { company: updates.company } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.requirements !== undefined ? { requirements: updates.requirements } : {}),
        ...(updates.nbd !== undefined ? { nbd: updates.nbd } : {}),
        ...(updates.totalPrice !== undefined ? { total_price: updates.totalPrice } : {}),
        ...(updates.companyAddress !== undefined ? { company_address: updates.companyAddress } : {}),
        ...(updates.billingAddress !== undefined ? { billing_address: updates.billingAddress } : {}),
        ...(updates.dateCreated !== undefined ? { date_created: updates.dateCreated } : {}),
        ...(updates.groupId !== undefined ? { group_id: updates.groupId } : {}),
        ...(updates.expanded !== undefined ? { expanded: updates.expanded } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.activityLog !== undefined ? { activity_log: updates.activityLog } : {}),
        ...(updates.customFields !== undefined ? { custom_fields: updates.customFields } : {}),
    };

    const { error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', clientId);

    if (error) throw error;

    for (const [key, value] of Object.entries(updates) as [keyof Client, unknown][]) {
        if (CLIENT_LOG_IGNORE_FIELDS.has(key)) continue;


        const oldValue =
            existing[
            key === 'replyStatus' ? 'reply_status' :
                key === 'followUp' ? 'follow_up' :
                    key === 'totalPrice' ? 'total_price' :
                        key === 'companyAddress' ? 'company_address' :
                            key === 'billingAddress' ? 'billing_address' :
                                key === 'dateCreated' ? 'date_created' :
                                    key === 'groupId' ? 'group_id' :
                                        key
            ];

        if (isEqualForLog(oldValue, value)) continue;

        await insertActivityLog({
            clientId,
            action: 'field_changed',
            fieldName: key,
            oldValue: formatValueForLog(oldValue),
            newValue: formatValueForLog(value),
        });
    }
}

export async function deleteClientRow(clientId: string) {
    const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

    if (error) throw error;
}

// subitem functions
export async function createSubitemRow(clientId: string) {
    const timelineRows = [
        { id: crypto.randomUUID(), name: 'Sample', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '' },
        { id: crypto.randomUUID(), name: 'Production 📦', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Sample' },
        { id: crypto.randomUUID(), name: 'Check Production Status (+3 from production start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '' },
        { id: crypto.randomUUID(), name: 'Local Shipping 🚚', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Production FS-1' },
        { id: crypto.randomUUID(), name: 'Sea/Air Freight ⛵✈️', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Local Shipping' },
        { id: crypto.randomUUID(), name: 'Check Shipment Status (+3 from shipment start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '' },
        { id: crypto.randomUUID(), name: 'NBD', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', status: '' },
    ];

    const { data, error } = await supabase
        .from('subitems')
        .insert({
            client_id: clientId,
            name: 'New Item',
            people: '',
            status: '',
            local_overseas: 'Local',
            qty: '',
            description: '',
            remarks: '',
            shipper: '',
            supplier: '',
            cost: '',
            manpower: '',
            manpower_rmb: '',
            ls: '',
            os: '',
            currency: '',
            c_sgd: '',
            tc: '',
            uc: '',
            tc_sgd: '',
            price: '',
            up: '',
            num_of_cartons: '',
            cn_tracking: '',
            sg_tracking: '',
            owner: '',
            payment: '',
            payment_status: '',
            total_uc: '',
            ls_rmb: '',
            total_c: '',
            mode_of_payment: '',
            order_number: '',
            quantity_produced: '',
            sample: '',
            qty_for: '',
            payment_amount: '',
            difference: '',
            payment_remarks: '',
            timeline_rows: timelineRows,
            show_timeline: false,
            show_payments: false,
            show_sample: false,
            sample_rows: [],
            sample_order_status: '',
            sample_status: '',
            sample_type: '',
            custom_fields: {},
            shipper_id: null
        })
        .select('*')
        .single();

    if (error) throw error;

    await insertActivityLog({
        clientId,
        subitemId: data.id,
        subitemName: data.name,
        action: 'subitem_added',
    });

    return data;
}

export async function fetchOptionsByGroupCode(code: string): Promise<{ value: string; color: string }[]> {
    const supabase = createClient()
    const { data: group } = await supabase
        .from('option_groups')
        .select('id')
        .eq('code', code)
        .single()

    if (!group) return []

    const { data } = await supabase
        .from('option_values')
        .select('value, color')
        .eq('group_id', group.id)
        .order('sort_order')

    return data ?? []
}

export async function updateSubitemRow(subitemId: string, updates: Partial<Subitem>) {
    const SHIPPER_NAME_TO_ID: Record<string, string> = {
        "小李 - SEA": "67bdaa10-2e2b-4f62-8b9b-118be712fe55",
        "小李 - AIR": "67bdaa10-2e2b-4f62-8b9b-118be712fe55",
        "Tiger - SEA": "61d1c7d6-3a99-412e-872a-c1e1c21193a1",
        "Tiger - AIR": "61d1c7d6-3a99-412e-872a-c1e1c21193a1",
        "A5 汇荣": "9e9e0dc2-3448-4de2-b2c6-b9003f5dcff4",
    };

    const nextUpdates: Partial<Subitem> = { ...updates };

    if ("qty" in updates || "up" in updates) {
        const qty = Number(updates.qty ?? 0);
        const up = Number(updates.up ?? 0);
        nextUpdates.price = String(qty * up);
    }

    nextUpdates.shipperId = nextUpdates.shipper
        ? (SHIPPER_NAME_TO_ID[nextUpdates.shipper] ?? null)
        : null;

    const { error } = await supabase
        .from("subitems")
        .update({
            ...(nextUpdates.status !== undefined ? { status: nextUpdates.status } : {}),
            ...(nextUpdates.shipperId !== undefined ? { shipper_id: nextUpdates.shipperId } : {}),
            ...(nextUpdates.shipper !== undefined ? { shipper: nextUpdates.shipper } : {}),
            ...(nextUpdates.price !== undefined ? { price: nextUpdates.price } : {}),
            ...(nextUpdates.qty !== undefined ? { qty: nextUpdates.qty } : {}),
            ...(nextUpdates.up !== undefined ? { up: nextUpdates.up } : {}),
            ...(nextUpdates.name !== undefined ? { name: nextUpdates.name } : {}),
            ...(nextUpdates.people !== undefined ? { people: nextUpdates.people } : {}),
            ...(nextUpdates.localOverseas !== undefined ? { local_overseas: nextUpdates.localOverseas } : {}),
            ...(nextUpdates.description !== undefined ? { description: nextUpdates.description } : {}),
            ...(nextUpdates.remarks !== undefined ? { remarks: nextUpdates.remarks } : {}),
            ...(nextUpdates.supplier !== undefined ? { supplier: nextUpdates.supplier } : {}),
            ...(nextUpdates.cost !== undefined ? { cost: nextUpdates.cost } : {}),
            ...(nextUpdates.manpower !== undefined ? { manpower: nextUpdates.manpower } : {}),
            ...(nextUpdates.manpowerRmb !== undefined ? { manpower_rmb: nextUpdates.manpowerRmb } : {}),
            ...(nextUpdates.ls !== undefined ? { ls: nextUpdates.ls } : {}),
            ...(nextUpdates.os !== undefined ? { os: nextUpdates.os } : {}),
            ...(nextUpdates.currency !== undefined ? { currency: nextUpdates.currency } : {}),
            ...(nextUpdates.cSgd !== undefined ? { c_sgd: nextUpdates.cSgd } : {}),
            ...(nextUpdates.tc !== undefined ? { tc: nextUpdates.tc } : {}),
            ...(nextUpdates.uc !== undefined ? { uc: nextUpdates.uc } : {}),
            ...(nextUpdates.tcSgd !== undefined ? { tc_sgd: nextUpdates.tcSgd } : {}),
            ...(nextUpdates.pl !== undefined ? { pl: nextUpdates.pl } : {}),
            ...(nextUpdates.sl !== undefined ? { sl: nextUpdates.sl } : {}),
            ...(nextUpdates.numOfCartons !== undefined ? { num_of_cartons: nextUpdates.numOfCartons } : {}),
            ...(nextUpdates.cnTracking !== undefined ? { cn_tracking: nextUpdates.cnTracking } : {}),
            ...(nextUpdates.sgTracking !== undefined ? { sg_tracking: nextUpdates.sgTracking } : {}),
            ...(nextUpdates.owner !== undefined ? { owner: nextUpdates.owner } : {}),
            ...(nextUpdates.payment !== undefined ? { payment: nextUpdates.payment } : {}),
            ...(nextUpdates.paymentStatus !== undefined ? { payment_status: nextUpdates.paymentStatus } : {}),
            ...(nextUpdates.totalUc !== undefined ? { total_uc: nextUpdates.totalUc } : {}),
            ...(nextUpdates.lsRmb !== undefined ? { ls_rmb: nextUpdates.lsRmb } : {}),
            ...(nextUpdates.totalC !== undefined ? { total_c: nextUpdates.totalC } : {}),
            ...(nextUpdates.modeOfPayment !== undefined ? { mode_of_payment: nextUpdates.modeOfPayment } : {}),
            ...(nextUpdates.orderNumber !== undefined ? { order_number: nextUpdates.orderNumber } : {}),
            ...(nextUpdates.quantityProduced !== undefined ? { quantity_produced: nextUpdates.quantityProduced } : {}),
            ...(nextUpdates.sample !== undefined ? { sample: nextUpdates.sample } : {}),
            ...(nextUpdates.qtyFor !== undefined ? { qty_for: nextUpdates.qtyFor } : {}),
            ...(nextUpdates.paymentAmount !== undefined ? { payment_amount: nextUpdates.paymentAmount } : {}),
            ...(nextUpdates.difference !== undefined ? { difference: nextUpdates.difference } : {}),
            ...(nextUpdates.paymentRemarks !== undefined ? { payment_remarks: nextUpdates.paymentRemarks } : {}),
            ...(nextUpdates.timelineRows !== undefined ? { timeline_rows: nextUpdates.timelineRows } : {}),
            ...(nextUpdates.showTimeline !== undefined ? { show_timeline: nextUpdates.showTimeline } : {}),
            ...(nextUpdates.showPayments !== undefined ? { show_payments: nextUpdates.showPayments } : {}),
            ...(nextUpdates.showSample !== undefined ? { show_sample: nextUpdates.showSample } : {}),
            ...(nextUpdates.sampleRows !== undefined ? { sample_rows: nextUpdates.sampleRows } : {}),
            ...(nextUpdates.sampleOrderStatus !== undefined ? { sample_order_status: nextUpdates.sampleOrderStatus } : {}),
            ...(nextUpdates.sampleStatus !== undefined ? { sample_status: nextUpdates.sampleStatus } : {}),
            ...(nextUpdates.sampleType !== undefined ? { sample_type: nextUpdates.sampleType } : {}),
            ...(nextUpdates.customFields !== undefined ? { custom_fields: nextUpdates.customFields } : {}),
        })
        .eq("id", subitemId);

    if (error) throw error;
}
export async function deleteSubitemRow(subitemId: string) {
    const { data: existing, error: fetchError } = await supabase
        .from('subitems')
        .select('*')
        .eq('id', subitemId)
        .single();

    if (fetchError) throw fetchError;

    try {
        await insertActivityLog({
            clientId: existing.client_id,
            subitemId: null,
            subitemName: existing.name,
            action: 'subitem_deleted',
            oldValue: {
                id: existing.id,
                name: existing.name,
                qty: existing.qty,
                remarks: existing.remarks ?? null,
            },
        });
    } catch (logError: any) {
        console.error('Failed to insert delete activity log', {
            error: logError,
            message: logError?.message,
            details: logError?.details,
            hint: logError?.hint,
            code: logError?.code,
        });
    }

    const { error } = await supabase
        .from('subitems')
        .delete()
        .eq('id', subitemId);

    if (error) throw error;
}