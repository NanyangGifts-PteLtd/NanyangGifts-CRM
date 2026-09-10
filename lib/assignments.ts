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

function sameIds(left: string[], right: string[]) {
    const first = [...new Set(left)].sort();
    const second = [...new Set(right)].sort();
    return first.length === second.length && first.every((id, index) => id === second[index]);
}

async function logClientAssignmentChange(params: {
    clientId: string;
    assignmentType: ClientAssignmentType;
    previousIds: string[];
    selectedIds: string[];
    currentUserId?: string | null;
}) {
    const previousIds = [...new Set(params.previousIds)];
    const selectedIds = [...new Set(params.selectedIds)];
    const addedIds = selectedIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !selectedIds.includes(id));
    if (!addedIds.length && !removedIds.length) return;

    const profileIds = [...new Set([
        ...previousIds,
        ...selectedIds,
        ...(params.currentUserId ? [params.currentUserId] : []),
    ])];
    const { data: profiles, error: profileError } = profileIds.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', profileIds)
        : { data: [], error: null };
    if (profileError) throw profileError;

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const displayName = (id: string) => {
        const profile = profileById.get(id);
        return profile?.full_name?.trim() || profile?.email || id;
    };
    const actor = params.currentUserId ? profileById.get(params.currentUserId) : null;
    const actorName = actor?.full_name?.trim() || actor?.email || 'Unknown user';
    const label = params.assignmentType === 'pm' ? 'PM' : 'People';
    const changes = [
        addedIds.length ? `Added ${addedIds.map(displayName).join(', ')}` : '',
        removedIds.length ? `Removed ${removedIds.map(displayName).join(', ')}` : '',
    ].filter(Boolean).join('. ');

    const { error } = await supabase.from('activity_log').insert({
        client_id: params.clientId,
        subitem_id: null,
        actor_name: actorName,
        action: 'assignment_changed',
        field_name: params.assignmentType === 'pm' ? 'pmAssignees' : 'peopleAssignees',
        old_value: previousIds.map(displayName),
        new_value: selectedIds.map(displayName),
        subitem_name: null,
        link: null,
        title: `updated ${label} assignments`,
        description: changes ? `${changes}.` : null,
        meta: {
            assignmentEvent: 'manual_update',
            assignmentType: params.assignmentType,
            previousAssigneeIds: previousIds,
            selectedAssigneeIds: selectedIds,
            addedAssigneeIds: addedIds,
            removedAssigneeIds: removedIds,
            changedByUserId: params.currentUserId ?? null,
        },
        created_at: new Date().toISOString(),
    });
    if (error) throw error;
}

async function logSubitemAssignmentChange(params: {
    clientId: string;
    subitemId: string;
    subitemName: string;
    previousIds: string[];
    selectedIds: string[];
    currentUserId?: string | null;
}) {
    const previousIds = [...new Set(params.previousIds)];
    const selectedIds = [...new Set(params.selectedIds)];
    const addedIds = selectedIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !selectedIds.includes(id));
    if (!addedIds.length && !removedIds.length) return;

    const profileIds = [...new Set([
        ...previousIds,
        ...selectedIds,
        ...(params.currentUserId ? [params.currentUserId] : []),
    ])];
    const { data: profiles, error: profileError } = profileIds.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', profileIds)
        : { data: [], error: null };
    if (profileError) throw profileError;

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const displayName = (id: string) => {
        const profile = profileById.get(id);
        return profile?.full_name?.trim() || profile?.email || id;
    };
    const actor = params.currentUserId ? profileById.get(params.currentUserId) : null;
    const actorName = actor?.full_name?.trim() || actor?.email || 'Unknown user';
    const changes = [
        addedIds.length ? `Added ${addedIds.map(displayName).join(', ')}` : '',
        removedIds.length ? `Removed ${removedIds.map(displayName).join(', ')}` : '',
    ].filter(Boolean).join('. ');

    const { error } = await supabase.from('activity_log').insert({
        client_id: params.clientId,
        subitem_id: params.subitemId,
        actor_name: actorName,
        action: 'assignment_changed',
        field_name: 'subitemAssignees',
        old_value: previousIds.map(displayName),
        new_value: selectedIds.map(displayName),
        subitem_name: params.subitemName,
        link: null,
        title: `updated assignments for subitem ${params.subitemName}`,
        description: changes ? `${changes}.` : null,
        meta: {
            assignmentEvent: 'manual_update',
            assignmentType: 'subitem',
            previousAssigneeIds: previousIds,
            selectedAssigneeIds: selectedIds,
            addedAssigneeIds: addedIds,
            removedAssigneeIds: removedIds,
            changedByUserId: params.currentUserId ?? null,
        },
        created_at: new Date().toISOString(),
    });
    if (error) throw error;
}

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
    const normalizedSelectedIds = [...new Set(selectedProfileIds)];
    const { data: previousAssignments, error: readError } = await supabase
        .from('client_assignees')
        .select('user_id')
        .eq('client_id', clientId)
        .eq('assignment_type', assignmentType);

    if (readError) throw readError;
    const previousIds = (previousAssignments ?? []).map((row) => row.user_id as string);
    if (sameIds(previousIds, normalizedSelectedIds)) return;

    const { error: deleteError } = await supabase
        .from('client_assignees')
        .delete()
        .eq('client_id', clientId)
        .eq('assignment_type', assignmentType);

    if (deleteError) throw deleteError;

    if (!normalizedSelectedIds.length) {
        await logClientAssignmentChange({
            clientId,
            assignmentType,
            previousIds,
            selectedIds: normalizedSelectedIds,
            currentUserId,
        });
        return;
    }

    const rows = normalizedSelectedIds.map((profileId) => ({
        client_id: clientId,
        user_id: profileId,
        assignment_type: assignmentType,
        assigned_by: currentUserId ?? null,
    }));

    const { error: insertError } = await supabase
        .from('client_assignees')
        .insert(rows);

    if (insertError) throw insertError;

    await logClientAssignmentChange({
        clientId,
        assignmentType,
        previousIds,
        selectedIds: normalizedSelectedIds,
        currentUserId,
    });
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
    const normalizedSelectedIds = [...new Set(selectedProfileIds)];
    const [{ data: subitem, error: subitemError }, { data: previousAssignments, error: readError }] = await Promise.all([
        supabase.from('subitems').select('id, client_id, name').eq('id', subitemId).single(),
        supabase.from('subitem_assignees').select('user_id').eq('subitem_id', subitemId),
    ]);
    if (subitemError) throw subitemError;
    if (readError) throw readError;

    const previousIds = (previousAssignments ?? []).map((row) => row.user_id as string);
    if (sameIds(previousIds, normalizedSelectedIds)) return;

    const { error: deleteError } = await supabase
        .from('subitem_assignees')
        .delete()
        .eq('subitem_id', subitemId);
    if (deleteError) throw deleteError;

    const rows = normalizedSelectedIds.map((profileId) => ({
        subitem_id: subitemId,
        user_id: profileId,
        assigned_by: currentUserId ?? null,
    }));

    if (rows.length) {
        const { error } = await supabase.from('subitem_assignees').insert(rows);
        if (error) throw error;
    }

    await logSubitemAssignmentChange({
        clientId: subitem.client_id,
        subitemId,
        subitemName: subitem.name || 'Unnamed subitem',
        previousIds,
        selectedIds: normalizedSelectedIds,
        currentUserId,
    });
}
