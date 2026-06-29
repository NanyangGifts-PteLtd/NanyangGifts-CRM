// fetches clients with nested subitems
// map db rows to client
// map client/subitem updates back into db column names
// expose crud functions

import { createClient } from '@/lib/supabase/client';
import type { TimelineRow, Client, Subitem, ActivityEntry, ClientAssigneeMap } from '@/app/types';
import { addClientAssignee } from './assignments';


const supabase = createClient();

const CLIENT_LOG_IGNORE_FIELDS = new Set<keyof Client>([
    'expanded',
    'activityLog',
    'color',
    'subitems',
]);
const SUBITEM_LOG_IGNORE_FIELDS = new Set<keyof Subitem>([
    'showTimeline',
    'showPayments',
    'showSample',
    'timelineRows'
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
    return (data?.[0] ?? null) as { user_id: string; position: number} | null;
}

export async function swapSalesRoundRobinFunctions(firstUserId: string, secondUserId: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc('swap_sales_round_robin_positions', {
        first_user_id: firstUserId,
        second_user_id: secondUserId,
    });

    if (error) throw error;
}

export async function setSalesRoundRobinActive(userId: string, isActive: boolean){
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
    ls: string | null;
    os: string | null;
    tc: string | null;
    uc: string | null;
    tc_sgd: string | null;
    price: string | null;
    up: string | null;
    num_of_cartons: string | null;
    cn_tracking: string | null;
    sg_tracking: string | null;
    owner: string | null;
    payment_status: string | null;
    total: string | null;
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
    expanded: boolean | null;
    color: string | null;
    activity_log?: ActivityLogRow[] | null;
    subitems?: Subitems[];
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
function isEqualForLog(a: unknown, b: unknown){
    return JSON.stringify(a) === JSON.stringify(b);
}

function formatValueForLog(value: unknown): unknown {
    if (value == null) return null;

    if (Array.isArray(value)){
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

    for (const [rowId, newRow] of newMap.entries()){
        const oldRow = oldMap.get(rowId);

        if (!oldRow){
            await insertActivityLog({
                clientId: params.clientId,
                subitemId: params.subitemId,
                subitemName: params.subitemName,
                action: 'subitem_field_changed',
                fieldName: 'timeline row ${newRow.name ?? rowId} added',
                oldValue: null,
                newValue: newRow,
            });
            continue;
        }

        for (const field of TIMELINE_LOG_FIELDS){
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


function mapActivityEntry(row: ActivityLogRow) {
    return {
        id: row.id,
        actorName: row.actor_name ?? 'Unknown user',
        action: row.action as ActivityEntry['action'],
        fieldName: row.field_name ?? '',
        oldValue: row.old_value ?? '',
        newValue: row.new_value ?? '',
        subitemName: row.subitem_name ?? '',
        createdAt: row.created_at,
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
        ls: row.ls ?? '',
        os: row.os ?? '',
        tc: row.tc ?? '',
        uc: row.uc ?? '',
        tcSgd: row.tc_sgd ?? '',
        price: row.price ?? '',
        up: row.up ?? '',
        numOfCartons: row.num_of_cartons ?? '',
        cnTracking: row.cn_tracking ?? '',
        sgTracking: row.sg_tracking ?? '',
        owner: row.owner ?? '',
        paymentStatus: row.payment_status ?? '',
        total: row.total ?? '',
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
        qty: row.qty ?? '',
        nbd: row.nbd ?? '',
        totalPrice: row.total_price ?? '',
        companyAddress: row.company_address ?? '',
        billingAddress: row.billing_address ?? '',
        dateCreated: row.date_created ?? '',
        expanded: row.expanded ?? false,
        color: row.color ?? '#7BCBD5',
        activityLog: (row.activity_log ?? []).map(mapActivityEntry),
        subitems: (row.subitems ?? []).map(mapSubitems),
    };
}

async function insertActivityLog(params: {
    clientId: string;
    subitemId?: string | null;
    action: 'field_changed' | 'subitem_added' | 'subitem_deleted' | 'subitem_field_changed';
    fieldName?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    subitemName?: string | null;
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
export async function fetchClientsWithSubitems() {
    const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
      *,
        subitems (*)
    `)
        .order('date_created', { ascending: false });

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

export async function createClientRow(currentUserId?: string | null) {
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
            qty: '',
            nbd: '',
            total_price: '',
            company_address: '',
            billing_address: '',
            date_created: '',
            expanded: true,
            color: '#7BCBD5',
            activity_log: [],
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

export async function updateClientRow(clientId: string, updates: Partial<Client>) {
    const { data: existing, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

    if (fetchError) throw fetchError;

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
        ...(updates.qty !== undefined ? { qty: updates.qty } : {}),
        ...(updates.nbd !== undefined ? { nbd: updates.nbd } : {}),
        ...(updates.totalPrice !== undefined ? { total_price: updates.totalPrice } : {}),
        ...(updates.companyAddress !== undefined ? { company_address: updates.companyAddress } : {}),
        ...(updates.billingAddress !== undefined ? { billing_address: updates.billingAddress } : {}),
        ...(updates.dateCreated !== undefined ? { date_created: updates.dateCreated } : {}),
        ...(updates.expanded !== undefined ? { expanded: updates.expanded } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.activityLog !== undefined ? { activity_log: updates.activityLog } : {}),
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
        { id: crypto.randomUUID(), name: 'Sample', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', status: '' },
        { id: crypto.randomUUID(), name: 'Production 📦', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Sample', status: '' },
        { id: crypto.randomUUID(), name: 'Check Production Status (+3 from production start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', status: '' },
        { id: crypto.randomUUID(), name: 'Local Shipping 🚚', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Production FS-1', status: '' },
        { id: crypto.randomUUID(), name: 'Sea/Air Freight ⛵✈️', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Local Shipping', status: '' },
        { id: crypto.randomUUID(), name: 'Check Shipment Status (+3 from shipment start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', status: '' },
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
            ls: '',
            os: '',
            tc: '',
            uc: '',
            tc_sgd: '',
            price: '',
            up: '',
            num_of_cartons: '',
            cn_tracking: '',
            sg_tracking: '',
            owner: '',
            payment_status: '',
            total: '',
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

export async function updateSubitemRow(subitemId: string, updates: Partial<Subitem>) {
    const { data: existing, error: fetchError } = await supabase
        .from('subitems')
        .select('*')
        .eq('id', subitemId)
        .single();

    if (fetchError) throw fetchError;
    
    if (updates.timelineRows !== undefined){
        await logTimelineRowDiffs({
            clientId: existing.client_id,
            subitemId,
            subitemName: existing.name ?? 'Subitem',
            oldRows: (existing.timeline_rows ?? []) as TimelineRow[],
            newRows: updates.timelineRows as TimelineRow[],
        })
    }
    const payload = {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.people !== undefined ? { people: updates.people } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.localOverseas !== undefined ? { local_overseas: updates.localOverseas } : {}),
        ...(updates.qty !== undefined ? { qty: updates.qty } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.remarks !== undefined ? { remarks: updates.remarks } : {}),
        ...(updates.shipper !== undefined ? { shipper: updates.shipper } : {}),
        ...(updates.supplier !== undefined ? { supplier: updates.supplier } : {}),
        ...(updates.cost !== undefined ? { cost: updates.cost } : {}),
        ...(updates.manpower !== undefined ? { manpower: updates.manpower } : {}),
        ...(updates.ls !== undefined ? { ls: updates.ls } : {}),
        ...(updates.os !== undefined ? { os: updates.os } : {}),
        ...(updates.tc !== undefined ? { tc: updates.tc } : {}),
        ...(updates.uc !== undefined ? { uc: updates.uc } : {}),
        ...(updates.tcSgd !== undefined ? { tc_sgd: updates.tcSgd } : {}),
        ...(updates.price !== undefined ? { price: updates.price } : {}),
        ...(updates.up !== undefined ? { up: updates.up } : {}),
        ...(updates.numOfCartons !== undefined ? { num_of_cartons: updates.numOfCartons } : {}),
        ...(updates.cnTracking !== undefined ? { cn_tracking: updates.cnTracking } : {}),
        ...(updates.sgTracking !== undefined ? { sg_tracking: updates.sgTracking } : {}),
        ...(updates.owner !== undefined ? { owner: updates.owner } : {}),
        ...(updates.paymentStatus !== undefined ? { payment_status: updates.paymentStatus } : {}),
        ...(updates.total !== undefined ? { total: updates.total } : {}),
        ...(updates.lsRmb !== undefined ? { ls_rmb: updates.lsRmb } : {}),
        ...(updates.totalC !== undefined ? { total_c: updates.totalC } : {}),
        ...(updates.modeOfPayment !== undefined ? { mode_of_payment: updates.modeOfPayment } : {}),
        ...(updates.orderNumber !== undefined ? { order_number: updates.orderNumber } : {}),
        ...(updates.quantityProduced !== undefined ? { quantity_produced: updates.quantityProduced } : {}),
        ...(updates.sample !== undefined ? { sample: updates.sample } : {}),
        ...(updates.qtyFor !== undefined ? { qty_for: updates.qtyFor } : {}),
        ...(updates.paymentAmount !== undefined ? { payment_amount: updates.paymentAmount } : {}),
        ...(updates.difference !== undefined ? { difference: updates.difference } : {}),
        ...(updates.paymentRemarks !== undefined ? { payment_remarks: updates.paymentRemarks } : {}),
        ...(updates.timelineRows !== undefined ? { timeline_rows: updates.timelineRows } : {}),
        ...(updates.showTimeline !== undefined ? { show_timeline: updates.showTimeline } : {}),
        ...(updates.showPayments !== undefined ? { show_payments: updates.showPayments } : {}),
        ...(updates.showSample !== undefined ? { show_sample: updates.showSample } : {}),
        ...(updates.sampleRows !== undefined ? { sample_rows: updates.sampleRows } : {}),
        ...(updates.sampleOrderStatus !== undefined ? { sample_order_status: updates.sampleOrderStatus } : {}),
        ...(updates.sampleStatus !== undefined ? { sample_status: updates.sampleStatus } : {}),
        ...(updates.sampleType !== undefined ? { sample_type: updates.sampleType } : {}),
    };

    const { error } = await supabase
        .from('subitems')
        .update(payload)
        .eq('id', subitemId);

    if (error) throw error;

    for (const [key, value] of Object.entries(updates) as [keyof Subitem, unknown][]) {
        if (SUBITEM_LOG_IGNORE_FIELDS.has(key)) continue;

        const oldValue =
            existing[
            key === 'localOverseas' ? 'local_overseas' :
            key === 'tcSgd' ? 'tc_sgd' :
            key === 'numOfCartons' ? 'num_of_cartons' :
            key === 'cnTracking' ? 'cn_tracking' :
            key === 'sgTracking' ? 'sg_tracking' :
            key === 'paymentStatus' ? 'payment_status' :
            key === 'lsRmb' ? 'ls_rmb' :
            key === 'totalC' ? 'total_c' :
            key === 'modeOfPayment' ? 'mode_of_payment' :
            key === 'orderNumber' ? 'order_number' :
            key === 'quantityProduced' ? 'quantity_produced' :
            key === 'qtyFor' ? 'qty_for' :
            key === 'paymentAmount' ? 'payment_amount' :
            key === 'paymentRemarks' ? 'payment_remarks' :
            key === 'timelineRows' ? 'timeline_rows' :
            key === 'showTimeline' ? 'show_timeline' :
            key === 'showPayments' ? 'show_payments' :
            key === 'showSample' ? 'show_sample' :
            key === 'sampleRows' ? 'sample_rows' :
            key === 'sampleOrderStatus' ? 'sample_order_status' :
            key === 'sampleStatus' ? 'sample_status' :
            key === 'sampleType' ? 'sample_type' :
            key
            ];
        if (isEqualForLog(oldValue, value)) continue;
        
        await insertActivityLog({
            clientId: existing.client_id,
            subitemId,
            subitemName: existing.name,
            action: 'subitem_field_changed',
            fieldName: key,
            oldValue: formatValueForLog(oldValue),
            newValue: formatValueForLog(value),
        });

        
    }
}

export async function deleteSubitemRow(subitemId: string) {
    const { data: existing, error: fetchError } = await supabase
        .from('subitems')
        .select('*')
        .eq('id', subitemId)
        .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
        .from('subitems')
        .delete()
        .eq('id', subitemId);

    if (error) throw error;

    await insertActivityLog({
        clientId: existing.client_id,
        subitemId,
        subitemName: existing.name,
        action: 'subitem_deleted',
    });
}