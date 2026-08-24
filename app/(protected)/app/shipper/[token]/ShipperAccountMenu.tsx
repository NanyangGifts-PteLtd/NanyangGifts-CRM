"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/Change-Password-Modal";
import { createClient } from "@/lib/supabase/client";

export default function ShipperAccountMenu({ name }: { name?: string | null }) {
    const [open, setOpen] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const closeMenu = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", closeMenu);
        return () => document.removeEventListener("mousedown", closeMenu);
    }, []);

    const logout = async () => {
        setLoggingOut(true);
        await createClient().auth.signOut();
        router.replace("/auth/login");
        router.refresh();
    };

    const label = name?.trim() || "Account";
    return (
        <>
            <div ref={menuRef} className="relative">
                <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7BCBD5] text-[10px] font-semibold text-white">{label.slice(0, 2).toUpperCase()}</span>
                    <span>{label}</span>
                    <ChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                {open && (
                    <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <button type="button" onClick={() => { setOpen(false); setChangingPassword(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                            <KeyRound size={15} /> Change password
                        </button>
                        <button type="button" disabled={loggingOut} onClick={() => void logout()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                            <LogOut size={15} /> {loggingOut ? "Logging out..." : "Log out"}
                        </button>
                    </div>
                )}
            </div>
            <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
        </>
    );
}
