"use client";

import { use, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ComponentCard } from "../../components/component-card";
import { InputField } from "../../components/ui/input-field";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";

interface Props {
  params: Promise<{ Hname: string }>;
}

export default function HospitalLoginPage({ params }: Props) {
  // Unwrap promise params
  const resolvedParams = use(params);
  const hname = decodeURIComponent(resolvedParams.Hname);
  const router = useRouter();

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    // Simulate login logic, then redirect
    router.push(`/${encodeURIComponent(hname)}/masters`);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ComponentCard title={`${hname} Login`}>
          <form onSubmit={handleLogin} className="space-y-5">
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
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
}
