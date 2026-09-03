// for fetching client assignees, subitem assignees
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type ProfileOption = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
    role?: string | null;
};

export type ClientAssignmentType = 'people' | 'pm';

export type ClientAssignmentMaps = {
    people: Record<string, string[]>;
    pm: Record<string, string[]>;
};

export async function fetchClientAssignmentMaps(): Promise<ClientAssignmentMaps> {
    const { data, error } = await supabase
        .from('client_assignees')
        .select('client_id, user_id, assignment_type');

    if (error) throw error;

    const maps: ClientAssignmentMaps = { people: {}, pm: {} };

    for (const row of data ?? []) {
        const assignmentType: ClientAssignmentType = row.assignment_type === 'pm' ? 'pm' : 'people';
        const map = maps[assignmentType];
        if (!map[row.client_id]) {
            map[row.client_id] = [];
        }
        map[row.client_id].push(row.user_id);
    }

    return maps;
}

export async function fetchClientAssigneeMap() {
    return (await fetchClientAssignmentMaps()).people;
}

export async function fetchClientPmAssigneeMap() {
    return (await fetchClientAssignmentMaps()).pm;
}
export async function addClientAssignee(
    clientId: string,
    userId: string,
    currentUserId?: string | null,
    assignmentType: ClientAssignmentType = 'people',
) {
    const { data, error } = await supabase
        .from('client_assignees')
        .insert({
            client_id: clientId,
            user_id: userId,
            assignment_type: assignmentType,
            assigned_by: currentUserId ?? null,
        })
        .select('*');

    console.log('addClientAssignee data', data);
    console.log('addClientAssignee error', error);

    if (error) throw error;

    return data;
}

export async function fetchProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .order('full_name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProfileOption[];
}

export async function fetchClientAssigneeIds(clientId: string) {
    const { data, error } = await supabase
        .from('client_assignees')
        .select('user_id')
        .eq('client_id', clientId)
        .eq('assignment_type', 'people');

    if (error) throw error;
    return (data ?? []).map((row) => row.user_id as string);
}

export async function fetchSubitemAssigneeIds(subitemId: string) {
    const { data, error } = await supabase
        .from('subitem_assignees')
        .select('user_id')
        .eq('subitem_id', subitemId);

    if (error) throw error;
    return (data ?? []).map((row) => row.user_id as string);
}

export async function saveClientAssignees(
    clientId: string,
    selectedProfileIds: string[],
    currentUserId?: string | null,
    assignmentType: ClientAssignmentType = 'people',
) {
    const { error: deleteError } = await supabase
        .from('client_assignees')
        .delete()
        .eq('client_id', clientId)
        .eq('assignment_type', assignmentType);

    if (deleteError) throw deleteError;

    if (!selectedProfileIds.length) return;

    const rows = selectedProfileIds.map((profileId) => ({
        client_id: clientId,
        user_id: profileId,
        assignment_type: assignmentType,
        assigned_by: currentUserId ?? null,
    }));

    const { error: insertError } = await supabase
        .from('client_assignees')
        .insert(rows);

    if (insertError) throw insertError;
}

export async function saveClientPmAssignees(
    clientId: string,
    selectedProfileIds: string[],
    currentUserId?: string | null,
) {
    return saveClientAssignees(clientId, selectedProfileIds, currentUserId, 'pm');
}

export async function saveSubitemAssignees(
    subitemId: string,
    selectedProfileIds: string[],
    currentUserId?: string | null
) {
    const rows = selectedProfileIds.map((profileId) => ({
        subitem_id: subitemId,
        user_id: profileId,
        assigned_by: currentUserId ?? null,
    }));

    const { error } = await supabase
        .from("subitem_assignees")
        .upsert(rows, {
            onConflict: "subitem_id,user_id",
        });

    if (error) throw error;
}
