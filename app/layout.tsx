import type { Metadata } from "next";
import "./globals.css";
import { ConfirmationProvider } from "@/components/ui/confirmation-provider";
import { ThemeProvider } from "@/components/theme-provider";

const themeBootScript = `
try {
  var theme = localStorage.getItem('friday-theme');
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
} catch (_) {}
`;

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
    metadataBase: new URL(defaultUrl),
    title: "Friday - NanyangGifts CRM",
    description: "NanyangGifts Custom CRM",
    icons: {
        icon: [
            { url: "/Friday-icon.png", type: "image/png", sizes: "any" },
        ],
        shortcut: "/Friday-icon.png",
        apple: "/Friday-icon.png",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
            </head>
            <body className="antialiased">
                <ThemeProvider>
                    <ConfirmationProvider>{children}</ConfirmationProvider>
                </ThemeProvider>
                <div id="portal" />
            </body>
        </html>
    );
}
