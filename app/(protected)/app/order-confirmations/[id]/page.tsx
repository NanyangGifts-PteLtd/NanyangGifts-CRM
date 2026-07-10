import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OcfInternalView from "./ocf-internal-view";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function OrderConfirmationPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: ocf, error } = await supabase
        .from("order_confirmations")
        .select(`
        id,
        client_id,
        client_token,
        status,
        generated_at,
        estimated_delivery_date,
        estimated_delivery_notes,
        same_address_for_all_items,
        remarks_for_delivery,
        restricted_area,
        important_notes,
        client_name_snapshot,
        company_snapshot,
        delivery_address,
        client_contact_number,
        client_signature_path,
        recipient_name,
        salesperson_name,
        salesperson_email,
        salesperson_contact_number,
        client_signed_at,
        client_submitted_at,
        client_ip,
        locked_at,
        order_confirmation_items (
        id,
        qty,
        item_name,
        remarks,
        image_path
        )
    `)
        .eq("id", id)
        .single();

    if (error || !ocf) {
        notFound();
    }

    const items = await Promise.all(
        (ocf.order_confirmation_items ?? []).map(async (item: any) => {
            let imageUrl: string | null = null;

            if (item.image_path) {
                const { data, error } = await supabase.storage
                    .from("order-confirmation-files")
                    .createSignedUrl(item.image_path, 60 * 60);

                if (!error) {
                    imageUrl = data?.signedUrl ?? null;
                }
            }

            return {
                ...item,
                image_url: imageUrl,
            };
        })
    );

    let clientSignatureUrl: string | null = null;

    if (ocf.client_signature_path) {
        const { data, error } = await supabase.storage
            .from("order-confirmation-files")
            .createSignedUrl(ocf.client_signature_path, 60 * 60);

        if (!error) {
            clientSignatureUrl = data?.signedUrl ?? null;
        }
    }

    return (
        <OcfInternalView
            ocf={{
                ...ocf,
                client_signature_url: clientSignatureUrl,
                order_confirmation_items: items,
            }}
        />
    );
}