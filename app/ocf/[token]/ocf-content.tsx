import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientOcfView from "./client-ocf-view";

type Props = {
    params: Promise<{ token: string }>;
};

export default async function OcfContent({ params }: Props) {
    const { token } = await params;
    const supabase = await createClient();

    const { data: ocf, error } = await supabase
        .from("order_confirmations")
        .select(`
        id,
        client_token,
        status,
        generated_at,
        estimated_delivery_notes,
        important_notes,
        client_name_snapshot,
        company_snapshot,
        salesperson_name,
        salesperson_email,
        salesperson_contact_number,
        client_signed_at,
        client_submitted_at,
        client_ip,
        locked_at,
        same_address_for_all_items,
        order_confirmation_items (
        id,
        qty,
        item_name,
        image_path,
        remarks,
        delivery_name,
        delivery_address,
        delivery_contact_number,
        delivery_remarks
        )
    `)
        .eq("client_token", token)
        .single();

    if (error) {
        console.error("OCF fetch error:", error);
        throw new Error(error.message);
    }

    if (!ocf) {
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

    return (
        <ClientOcfView
            ocf={{
                ...ocf,
                order_confirmation_items: items,
            }}
        />
    );
}