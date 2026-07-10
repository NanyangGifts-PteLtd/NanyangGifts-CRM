import { Suspense } from "react";
import OcfContent from "./ocf-content";

type PageProps = {
    params: Promise<{ token: string }>;
};

function LoadingFallback() {
    return (
        <main className="min-h-screen bg-[#f3f4f6] px-4 py-8">
            <div className="mx-auto max-w-5xl bg-white p-6 shadow-lg">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-64 rounded bg-gray-200" />
                    <div className="h-24 rounded bg-gray-200" />
                    <div className="h-64 rounded bg-gray-200" />
                    <div className="h-40 rounded bg-gray-200" />
                </div>
            </div>
        </main>
    );
}

export default function ClientOcfPage({ params }: PageProps) {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <OcfContent params={params} />
        </Suspense>
    );
}