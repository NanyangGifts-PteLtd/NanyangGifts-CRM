import { Suspense } from "react";
import AuthGate from "./AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { DeploymentUpdateNotifier } from "@/components/DeploymentUpdateNotifier";

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentDeploymentVersion =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    "development";

  return (
    <Suspense fallback={null}>
      <AuthGate>
        {children}
        <DeploymentUpdateNotifier currentVersion={currentDeploymentVersion} />
        <Toaster position="top-center" closeButton richColors />
      </AuthGate>
    </Suspense>
  );
}
