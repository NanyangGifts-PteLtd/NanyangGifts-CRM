import { createClient } from '@/lib/supabase/client'

export type CustomColumn = {
    id: string
    name: string
    target: 'client' | 'subitem'
    field_type: 'text' | 'number' | 'date'
    sort_order: number
}

export async function fetchCustomColumns(): Promise<CustomColumn[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('custom_columns')
        .select('*')
        .order('sort_order')
    if (error) throw error
    return data ?? []
}

export async function addCustomColumn(
    name: string,
    target: 'client' | 'subitem',
    field_type: 'text' | 'number' | 'date' = 'text',
    sort_order: number = 0
): Promise<CustomColumn> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('custom_columns')
        .insert({ name, target, field_type, sort_order })
        .select('*')
        .single()
    if (error) throw error
    return data
}

export async function deleteCustomColumn(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from('custom_columns').delete().eq('id', id)
    if (error) throw error
}