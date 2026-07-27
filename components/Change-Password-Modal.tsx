'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChangePasswordModalProps {
    open: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!open) return null;

    const passwordsMatch = password === confirm;
    const isStrong = password.length >= 8;
    const canSubmit = password && confirm && passwordsMatch && isStrong && !loading;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setSuccess(true);
            setPassword('');
            setConfirm('');
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPassword('');
        setConfirm('');
        setError(null);
        setSuccess(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4">
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    {/* New password */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-9 text-sm outline-none focus:border-[#7BCBD5] focus:ring-2 focus:ring-[#7BCBD5]/20 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {password && !isStrong && (
                            <p className="mt-1 text-[11px] text-red-500">Password must be at least 8 characters</p>
                        )}
                    </div>

                    {/* Confirm password */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Re-enter your password"
                                className={`w-full rounded-lg border px-3 py-2 pr-9 text-sm outline-none focus:ring-2 transition ${confirm && !passwordsMatch
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                        : 'border-gray-200 focus:border-[#7BCBD5] focus:ring-[#7BCBD5]/20'
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm((v) => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {confirm && !passwordsMatch && (
                            <p className="mt-1 text-[11px] text-red-500">Passwords do not match</p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="flex items-center gap-2 text-[11px] text-green-600 bg-green-50 rounded-lg px-3 py-2">
                            <Check size={13} /> Password updated successfully
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                    <button
                        onClick={handleClose}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="rounded-xl bg-[#7BCBD5] px-4 py-2 text-xs font-medium text-white hover:bg-[#6bc0ca] disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            </div>
        </div>
    );
}