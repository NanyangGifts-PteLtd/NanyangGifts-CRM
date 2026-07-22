"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
    ocfId: string;
    clientToken: string;
    company: string;
    sameAddressForAllItems: boolean;
    items: {
        id: string;
        delivery_name?: string | null;
        delivery_address: string;
        delivery_contact_number: string;
        delivery_remarks: string;
    }[];
};

type SignatureMode = "draw" | "type";

export default function SignatureForm({
    ocfId,
    clientToken,
    company,
    sameAddressForAllItems,
    items,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    const [drawing, setDrawing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSignature, setHasSignature] = useState(false);

    const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
    const [typedInitials, setTypedInitials] = useState("");

    const displayWidth = 520;
    const displayHeight = 180;

    function setupCanvas() {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const cssWidth = Math.max(320, Math.floor(rect.width));
        const cssHeight = displayHeight;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);

        canvas.width = cssWidth * ratio;
        canvas.height = cssHeight * ratio;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
        ctx.fillStyle = "#111827";
        ctx.clearRect(0, 0, cssWidth, cssHeight);
    }

    useEffect(() => {
        setupCanvas();

        const handleResize = () => {
            if (signatureMode === "draw" && !hasSignature) {
                setupCanvas();
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [signatureMode, hasSignature]);

    useEffect(() => {
        if (signatureMode === "type") {
            drawTypedSignature();
        } else if (!hasSignature) {
            setupCanvas();
        }
    }, [signatureMode]);

    function getCtx() {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.getContext("2d");
    }

    function getPoint(
        e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
    ) {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const rawX = (e.clientX - rect.left) * scaleX;
        const rawY = (e.clientY - rect.top) * scaleY;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);

        return {
            x: rawX / ratio,
            y: rawY / ratio,
        };
    }

    function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
        if (signatureMode !== "draw") return;

        const ctx = getCtx();
        const point = getPoint(e);
        if (!ctx || !point) return;

        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        setDrawing(true);
        setHasSignature(true);
        setError(null);
    }

    function draw(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawing || signatureMode !== "draw") return;

        const ctx = getCtx();
        const point = getPoint(e);
        if (!ctx || !point) return;

        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    }

    function stopDrawing() {
        setDrawing(false);
    }

    function clearSignature() {
        setHasSignature(false);
        setTypedInitials("");
        setError(null);
        setupCanvas();
    }

    function drawTypedSignature() {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!typedInitials.trim()) {
            setHasSignature(false);
            return;
        }

        ctx.fillStyle = "#111827";
        ctx.font = "400 52px 'Brush Script MT', cursive";
        ctx.textBaseline = "middle";
        ctx.fillText(typedInitials.trim(), 24, rect.height / 2);

        setHasSignature(true);
        setError(null);
    }

    useEffect(() => {
        if (signatureMode === "type") {
            drawTypedSignature();
        }
    }, [typedInitials, signatureMode]);

    const typedPreviewLabel = useMemo(() => {
        return typedInitials.trim() || "Your initials preview";
    }, [typedInitials]);

    async function submitSignature() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (signatureMode === "draw" && !hasSignature) {
            setError("Please provide a signature before submitting.");
            return;
        }

        if (signatureMode === "type" && !typedInitials.trim()) {
            setError("Please type your initials before submitting.");
            return;
        }

        const signatureDataUrl = canvas.toDataURL("image/png");

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/order-confirmations/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ocfId,
                    clientToken,
                    signatureDataUrl,
                    signatureMode,
                    typedInitials: typedInitials.trim() || null,
                    company,
                    sameAddressForAllItems,
                    items,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result?.error || "Failed to submit form");
            }

            setDone(true);
        } catch (err: any) {
            setError(err.message || "Failed to submit form");
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                Signature submitted successfully. This form is now locked.
            </div>
        );
    }

    return (
        <div className="mt-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">
                Client signature
            </label>

            <div className="mb-3 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => {
                        setSignatureMode("draw");
                        setError(null);
                        setHasSignature(false);
                        setupCanvas();
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${signatureMode === "draw"
                            ? "bg-blue-400 text-white"
                            : "border border-gray-300 bg-white text-gray-700"
                        }`}
                >
                    Draw signature
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSignatureMode("type");
                        setError(null);
                        setHasSignature(false);
                        setupCanvas();
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${signatureMode === "type"
                            ? "bg-blue-400 text-white"
                            : "border border-gray-300 bg-white text-gray-700"
                        }`}
                >
                    Type initials
                </button>
            </div>

            {signatureMode === "type" && (
                <div className="mb-3 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Type your initials
                    </label>
                    <input
                        type="text"
                        value={typedInitials}
                        onChange={(e) => setTypedInitials(e.target.value.slice(0, 8))}
                        placeholder="e.g. J.T."
                        className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <p className="text-xs text-gray-500">
                        Preview: {typedPreviewLabel}
                    </p>
                </div>
            )}

            <div ref={wrapperRef} className="w-full max-w-[520px]">
                <canvas
                    ref={canvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    onPointerCancel={stopDrawing}
                    className="touch-none rounded-lg border border-gray-300 bg-white"
                />
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-3 flex gap-3">
                <button
                    type="button"
                    onClick={clearSignature}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Clear
                </button>

                <button
                    type="button"
                    onClick={submitSignature}
                    disabled={submitting}
                    className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? "Submitting..." : "Submit"}
                </button>
            </div>
        </div>
    );
}