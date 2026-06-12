"use client";

import { useState } from "react";
import { ComponentCard } from "../../components/component-card";
import { InputField } from "../../components/ui/input-field";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useRouter } from "next/navigation";

const MOCK_PHONE = "1234567890";
const MOCK_OTP = "123456";

export default function PatientLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (phone === MOCK_PHONE && otp === MOCK_OTP) {
      // Store mock patient name and navigate to dashboard
      try {
        localStorage.setItem("patientName", "John Doe");
      } catch (e) {
        // ignore
      }
      router.push("/patient-dashboard");
      return;
    }

    setError("Invalid phone number or OTP. Use mock credentials to continue.");
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ComponentCard title="Patient Login" desc="Enter phone and OTP to continue.">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {error}
              </div>
            ) : null}

            <div>
              <Label htmlFor="phone">Phone number</Label>
              <InputField
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="otp">OTP</Label>
              <InputField
                id="otp"
                name="otp"
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Verifying..." : "Login"}
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Mock credentials: <strong>{MOCK_PHONE}</strong> / <strong>{MOCK_OTP}</strong>
            </div>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
}
