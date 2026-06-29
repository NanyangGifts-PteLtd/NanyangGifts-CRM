import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type ProfileOption = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
};


export async function addClientAssignee(
    clientId: string,
    userId: string,
    currentUserId?: string | null
) {
    const { error } = await supabase
        .from('client_assignees')
        .insert({
            client_id: clientId,
            user_id: userId,
            assigned_by: currentUserId ?? null,
        });

    if (error) throw error;
}

export async function fetchProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .order('full_name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProfileOption[];
}

export async function fetchClientAssigneeIds(clientId: string) {
    const { data, error } = await supabase
        .from('client_assignees')
        .select('user_id')
        .eq('client_id', clientId);

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
    currentUserId?: string | null
) {
    const { error: deleteError } = await supabase
        .from('client_assignees')
        .delete()
        .eq('client_id', clientId);

    if (deleteError) throw deleteError;

    if (!selectedProfileIds.length) return;

    const rows = selectedProfileIds.map((profileId) => ({
        client_id: clientId,
        user_id: profileId,
        assigned_by: currentUserId ?? null,
    }));

    const { error: insertError } = await supabase
        .from('client_assignees')
        .insert(rows);

    if (insertError) throw insertError;
}

export async function saveSubitemAssignees(
    subitemId: string,
    selectedProfileIds: string[],
    currentUserId?: string | null
) {
    const { error: deleteError } = await supabase
        .from('subitem_assignees')
        .delete()
        .eq('subitem_id', subitemId);

    if (deleteError) throw deleteError;

    if (!selectedProfileIds.length) return;

    const rows = selectedProfileIds.map((profileId) => ({
        subitem_id: subitemId,
        user_id: profileId,
        assigned_by: currentUserId ?? null,
    }));

    const { error: insertError } = await supabase
        .from('subitem_assignees')
        .insert(rows);

    if (insertError) throw insertError;
}