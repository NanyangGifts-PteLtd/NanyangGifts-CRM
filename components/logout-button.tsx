"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ComponentProps } from "react";

type LogoutButtonProps = ComponentProps<typeof Button>;

export function LogoutButton({
  children="Logout",
  className,
  ...props
}: LogoutButtonProps){
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return <Button onClick={logout} className={className} {...props}>{children}</Button>;
}
