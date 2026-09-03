"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, MailPlus, RotateCcw, Send } from "lucide-react";
import type { Profile } from "../app/types";

type AllowedRole = "sales" | "pm" | "admin" | "dev" | "shipper";

const roles: AllowedRole[] = ["sales", "pm", "admin", "dev", "shipper"];

interface UserAdminPanelProps {
  profiles: Profile[];
}

export function UserAdminPanel({ profiles }: UserAdminPanelProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AllowedRole>("sales");
  const [shipperId, setShipperId] = useState("");
  const [shippers, setShippers] = useState<
    Array<{ id: string; name: string | null }>
  >([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suspendedById, setSuspendedById] = useState<Record<string, boolean>>(
    {},
  );
  const [pendingSuspension, setPendingSuspension] = useState<Profile | null>(
    null,
  );
  const [isSavingSuspension, setIsSavingSuspension] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/users").then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as {
        users: Array<{ id: string; suspended: boolean }>;
      };
      setSuspendedById(
        Object.fromEntries(
          result.users.map((user) => [user.id, user.suspended]),
        ),
      );
    });
  }, []);

  useEffect(() => {
    void fetch("/api/admin/shippers").then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as {
        shippers: Array<{ id: string; name: string | null }>;
      };
      setShippers(result.shippers);
    });
  }, []);

  const sortedProfiles = useMemo(() => {
    const roleOrder = ["director", "admin", "pm", "sales", "dev"] as const;
    return [...profiles].sort((a, b) => {
      const rankA = roleOrder.indexOf(
        (a.role || "").toLowerCase() as (typeof roleOrder)[number],
      );
      const rankB = roleOrder.indexOf(
        (b.role || "").toLowerCase() as (typeof roleOrder)[number],
      );
      if (
        (rankA === -1 ? roleOrder.length : rankA) !==
        (rankB === -1 ? roleOrder.length : rankB)
      )
        return (
          (rankA === -1 ? roleOrder.length : rankA) -
          (rankB === -1 ? roleOrder.length : rankB)
        );
      return (a.full_name || a.email || "").localeCompare(
        b.full_name || b.email || "",
      );
    });
  }, [profiles]);

  const saveSuspension = async () => {
    if (!pendingSuspension) return;
    const nextSuspended = !suspendedById[pendingSuspension.id];
    setIsSavingSuspension(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pendingSuspension.id,
          suspended: nextSuspended,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Unable to update account status.");
      setSuspendedById((previous) => ({
        ...previous,
        [pendingSuspension.id]: nextSuspended,
      }));
      setMessage(
        `${pendingSuspension.full_name || pendingSuspension.email || "User"} has been ${nextSuspended ? "suspended" : "restored"}.`,
      );
      setPendingSuspension(null);
    } catch (suspensionError) {
      setError(
        suspensionError instanceof Error
          ? suspensionError.message
          : "Unable to update account status.",
      );
    } finally {
      setIsSavingSuspension(false);
    }
  };

  const sendInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          shipperId: role === "shipper" ? shipperId : undefined,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        email?: string;
        role?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "The invitation could not be sent.");

      setMessage(
        `Invitation sent to ${result.email} with the ${result.role} role.`,
      );
      setEmail("");
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "The invitation could not be sent.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 bg-[#f8fafc] p-4">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7fdff] text-[#16a5c4]">
            <MailPlus size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User Admin</h2>
            <p className="text-sm text-slate-500">
              Invite a new team member and assign their initial role.
            </p>
          </div>
        </div>

        <form
          onSubmit={sendInvite}
          className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
        >
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/20"
            />
          </label>

          {role === "shipper" && (
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Shipper view
              <select
                required
                value={shipperId}
                onChange={(event) => setShipperId(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/20"
              >
                <option value="">Select shipper</option>
                {shippers.map((shipper) => (
                  <option key={shipper.id} value={shipper.id}>
                    {shipper.name || "Unnamed shipper"}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Initial role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AllowedRole)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/20"
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={isSending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#16a5c4] px-4 text-sm font-medium text-white hover:bg-[#0f8da8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={15} />
            {isSending ? "Sending..." : "Send invite via Email"}
          </button>
        </form>

        {message && (
          <p className="mx-5 mb-5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mx-5 mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Current team &amp; user suspension
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Suspend non-director accounts to prevent future sign-ins, or restore
            access when needed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-5 py-3">User</th>
                <th className="border-b border-slate-200 px-5 py-3">Email</th>
                <th className="border-b border-slate-200 px-5 py-3">Role</th>
                <th className="border-b border-slate-200 px-5 py-3">
                  Account status
                </th>
                <th className="border-b border-slate-200 px-5 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {profile.full_name || "Unnamed user"}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {profile.email || "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {profile.role || "unassigned"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${suspendedById[profile.id] ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {suspendedById[profile.id] ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {profile.role?.toLowerCase() !== "director" && (
                      <button
                        onClick={() => setPendingSuspension(profile)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium ${suspendedById[profile.id] ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                      >
                        {suspendedById[profile.id] ? (
                          <RotateCcw size={13} />
                        ) : (
                          <Ban size={13} />
                        )}
                        {suspendedById[profile.id]
                          ? "Restore account"
                          : "Suspend account"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {pendingSuspension && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              {suspendedById[pendingSuspension.id]
                ? "Restore account?"
                : "Suspend account?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {suspendedById[pendingSuspension.id]
                ? `${pendingSuspension.full_name || pendingSuspension.email || "This user"} will be able to sign in again.`
                : `${pendingSuspension.full_name || pendingSuspension.email || "This user"} will not be able to sign in until their account is restored.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={isSavingSuspension}
                onClick={() => setPendingSuspension(null)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={isSavingSuspension}
                onClick={() => void saveSuspension()}
                className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${suspendedById[pendingSuspension.id] ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {isSavingSuspension
                  ? "Saving..."
                  : suspendedById[pendingSuspension.id]
                    ? "Restore account"
                    : "Suspend account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
