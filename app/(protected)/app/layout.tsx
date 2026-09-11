import { Suspense } from "react";
import AuthGate from "./AuthGate";
import { Toaster } from "@/components/ui/sonner";

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AuthGate>
        {children}
        <Toaster position="top-center" closeButton richColors />
      </AuthGate>
    </Suspense>
  );
}
