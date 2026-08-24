import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShipperByToken } from "@/lib/shipper/get-shipper-by-token";
import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import ShipperGrid from "./ShipperGrid";
import ShipperAccountMenu from "./ShipperAccountMenu";

export default async function ShipperPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    const shipper = await getShipperByToken(token);
    if (!shipper) notFound();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/app/shipper/${token}`)}`);
    const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).maybeSingle();
    if (profile?.role === "shipper" && user.user_metadata?.shipper_id !== shipper.id) notFound();

    const rows = await getShipperSubitems(shipper.id);

    return (
        <main className="p-2">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold">{shipper.name}</h1>
                <ShipperAccountMenu name={profile?.full_name ?? profile?.email ?? user.email} />
            </div>
            <ShipperGrid rows={rows} mode="shipper" token={token} />
        </main>
    );
}
