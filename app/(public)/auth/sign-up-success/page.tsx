"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginButton } from "@/components/login-button";
import '../../../globals.css';
export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Thank you for signing up!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve successfully signed up. Please check your email to
                verify your account before signing in.
              </p>
              <br />
              <div className=" text-white">
                <LoginButton
                  className="bg-[#7BCBD5] text-white rounded px-4 py-2 text-med hover:bg-[#6db6bf] transition transform active:scale-95 duration-150"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
