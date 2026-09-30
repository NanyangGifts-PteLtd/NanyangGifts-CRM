import type { Metadata } from "next";
import "./globals.css";
import { ConfirmationProvider } from "@/components/ui/confirmation-provider";

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
    metadataBase: new URL(defaultUrl),
    title: "NanyangGifts CRM",
    description: "Custom CRM that I made",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="antialiased">
                <ConfirmationProvider>{children}</ConfirmationProvider>
                <div id="portal" />
            </body>
        </html>
    );
}
