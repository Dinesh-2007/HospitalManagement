"use client";

import { use, useState, useTransition } from "react";
import { ComponentCard } from "../../components/component-card";
import { InputField } from "../../components/ui/input-field";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { loginAction } from "../actions/auth";

interface Props {
  params: Promise<{ Hname: string }>;
}

export default function HospitalLoginPage({ params }: Props) {
  // Unwrap promise params
  const resolvedParams = use(params);
  const hname = decodeURIComponent(resolvedParams.Hname);
  
  const [errorMessages, setErrorMessages] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessages(null);
    const formData = new FormData(e.currentTarget);
    formData.append("hname", hname);

    startTransition(async () => {
      try {
        await loginAction(formData);
      } catch (error) {
        setErrorMessages(error instanceof Error ? error.message : "Failed to login");
      }
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ComponentCard title={`${hname} Login`}>
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMessages && (
              <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {errorMessages}
              </div>
            )}
            <div>
              <Label htmlFor="username">Username</Label>
              <InputField
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <InputField
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>
            <div className="pt-2">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
}
