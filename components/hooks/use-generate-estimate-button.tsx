import { useState } from 'react';

export function useGenerateEstimate() {
    const [isGeneratingEstimate, setIsGeneratingEstimate] = useState(false);
    const [estimateError, setEstimateError] = useState<string | null>(null);
    const [estimateSuccess, setEstimateSuccess] = useState(false);
    async function handleGenerateEstimate(
        clientId: string,
        companyName: string,
        salesperson: string,
        paymentTerm: string,
        deliveryBySubitem: Record<string, "singapore" | "other">,
    ) {
        try {
            setIsGeneratingEstimate(true);
            setEstimateError(null);

            const res = await fetch('/api/quickbooks/generate-estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clientId, companyName, salesperson, paymentTerm, deliveryBySubitem }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json?.error ?? 'Failed to generate quote');
            }

            if(res.ok){
                setEstimateSuccess(true);
            }

            return json;
        } catch (err: any) {
            const message = err?.message ?? 'Failed to generate quote';
            setEstimateError(message);
            throw err;
        } finally {
            setIsGeneratingEstimate(false);
        }
    }

    function resetEstimateState() {
        setEstimateError(null);
        setEstimateSuccess(false);
    }

    return {
        handleGenerateEstimate,
        isGeneratingEstimate,
        estimateError,
        estimateSuccess,
        resetEstimateState,
    };
}
