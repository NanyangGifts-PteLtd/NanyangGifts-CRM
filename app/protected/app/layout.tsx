import type { Metadata } from "next";
import "../../globals.css";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "NanyangGifts CRM",
  description: "aaaaaaaaaa",
};


export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user){
    redirect("/public/auth/login");
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`$ antialiased`}>
          {children}
      </body>
    </html>
  );
}
