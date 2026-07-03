import { useState } from 'react';

export function useGenerateEstimate() {
    const [isGeneratingEstimate, setIsGeneratingEstimate] = useState(false);
    const [estimateError, setEstimateError] = useState<string | null>(null);
    const [estimateSuccess, setEstimateSuccess] = useState(false);
    async function handleGenerateEstimate(clientId: string) {
        try {
            setIsGeneratingEstimate(true);
            setEstimateError(null);

            const res = await fetch('/api/quickbooks/generate-estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clientId }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json?.error ?? 'Failed to generate estimate');
            }

            if(res.ok){
                setEstimateSuccess(true);
            }

            return json;
        } catch (err: any) {
            const message = err?.message ?? 'Failed to generate estimate';
            setEstimateError(message);
            throw err;
        } finally {
            setIsGeneratingEstimate(false);
        }
    }

    return {
        handleGenerateEstimate,
        isGeneratingEstimate,
        estimateError,
        estimateSuccess
    };
}