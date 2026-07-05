"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PageBreadcrumb } from "./ui/page-breadcrumb";
import { Label } from "./ui/label";
import { InputField } from "./ui/input-field";
import { Button } from "./ui/button";
import { createAccountAction } from "../app/actions/tenant";

export function CreateAccountForm() {
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [siteNameVal, setSiteNameVal] = useState("");

  // OTP modal and display states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"mail" | "phone" | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [showMailOtp, setShowMailOtp] = useState(false);
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 10);
  };

  const handleSendOtpClick = (fieldId: "adminMail" | "phoneNumber") => {
    const input = document.getElementById(fieldId) as HTMLInputElement | null;
    const value = input?.value || "";
    if (!value.trim()) {
      alert(`Please enter a valid ${fieldId === "adminMail" ? "email address" : "phone number"} first.`);
      return;
    }
    setModalType(fieldId === "adminMail" ? "mail" : "phone");
    setModalValue(value);
    setModalOpen(true);
  };

  const handleConfirmSendOtp = () => {
    if (modalType === "mail") {
      setShowMailOtp(true);
    } else if (modalType === "phone") {
      setShowPhoneOtp(true);
    }
    setModalOpen(false);
  };

  const handleEditNumber = () => {
    setModalOpen(false);
    const inputId = modalType === "mail" ? "adminMail" : "phoneNumber";
    setTimeout(() => {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      input?.focus();
    }, 50);
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const hospitalName = String(formData.get("hospitalName") ?? "").trim();
    setSubmitMessage(
      `Initializing ${hospitalName} database... Please wait.`
    );

    startTransition(async () => {
      try {
        await createAccountAction(formData);
      } catch (error) {
        setSubmitMessage(
          `Failed to create account: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <PageBreadcrumb pageTitle="Create Account" />

      {/* Main Registration Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800 transition-all duration-300">

        {/* Dynamic Premium Header with Gradient Mesh and Glowing Shapes */}
        <div className="relative overflow-hidden bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-700 px-8 py-10 text-white">
          {/* Decorative Glow Elements */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/10 blur-3xl rounded-full" />
          <div className="absolute bottom-[-30px] left-[-30px] w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full" />

          <div className="relative z-10 flex items-center ">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 inline-flex shadow-inner">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                  Establish Hospital Workspace
                </h1>
              </div>
              <p className="text-sm text-brand-100 max-w-xl">
                Register ownership, configure custom sub-domains, and deploy the isolated database instance.
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {submitMessage && (
            <div className="mb-6 rounded-xl border border-success-200 bg-success-25 px-4 py-3 text-sm text-success-700 dark:border-success-800/40 dark:bg-success-500/10 dark:text-success-300 animate-fade-in">
              {submitMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Section 1: Hospital Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">01</span>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Hospital Profile
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="hospitalName">
                    Hospital Name <span className="text-error-500">*</span>
                  </Label>
                  <InputField
                    id="hospitalName"
                    name="hospitalName"
                    type="text"
                    placeholder="e.g. City General Hospital"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="siteName">
                    Site Name URL Slug <span className="text-error-500">*</span>
                  </Label>
                  <InputField
                    id="siteName"
                    name="siteName"
                    type="text"
                    placeholder="e.g. city-general"
                    value={siteNameVal}
                    onChange={(e) => setSiteNameVal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    required
                    hint="Only lowercase letters, numbers, and hyphens allowed."
                  />
                  {siteNameVal && (
                    <div className="mt-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 animate-fade-in">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
                      <span>Workspace URL: </span>
                      <strong className="text-brand-600 dark:text-brand-400 font-mono">
                        /{siteNameVal}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Administrator Identity */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">02</span>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Admin Credentials
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="creatorName">
                    Creator/Admin Name <span className="text-error-500">*</span>
                  </Label>
                  <InputField
                    id="creatorName"
                    name="creatorName"
                    type="text"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">
                    Admin Password <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <InputField
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create security password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition focus:outline-hidden cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Verification Rows (Mail & Phone) */}
                <div>
                  <Label htmlFor="adminMail">
                    Admin Email Address <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <InputField
                      id="adminMail"
                      name="adminMail"
                      type="email"
                      placeholder="admin@hospital.com"
                      required
                      className="pr-24"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendOtpClick("adminMail")}
                      className="absolute right-2 h-7.5 px-3 text-xs font-bold rounded-md bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 transition cursor-pointer"
                    >
                      Send OTP
                    </button>
                  </div>

                  {showMailOtp && (
                    <div className="mt-3 p-3.5 rounded-xl bg-brand-25/30 dark:bg-brand-950/10 border border-brand-100/30 dark:border-brand-900/10 animate-slide-in">
                      <Label htmlFor="adminMailOtp">
                        Email OTP Verification Code <span className="text-error-500">*</span>
                      </Label>
                      <InputField
                        id="adminMailOtp"
                        name="adminMailOtp"
                        type="text"
                        placeholder="Enter email OTP"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="phoneNumber">
                    Admin Phone Number <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <InputField
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      placeholder="Enter 10-digit phone"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      onChange={handlePhoneChange}
                      required
                      className="pr-24"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendOtpClick("phoneNumber")}
                      className="absolute right-2 h-7.5 px-3 text-xs font-bold rounded-md bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 transition cursor-pointer"
                    >
                      Send OTP
                    </button>
                  </div>

                  {showPhoneOtp && (
                    <div className="mt-3 p-3.5 rounded-xl bg-brand-25/30 dark:bg-brand-950/10 border border-brand-100/30 dark:border-brand-900/10 animate-slide-in">
                      <Label htmlFor="phoneNumberOtp">
                        Phone OTP Verification Code <span className="text-error-500">*</span>
                      </Label>
                      <InputField
                        id="phoneNumberOtp"
                        name="phoneNumberOtp"
                        type="text"
                        placeholder="Enter phone OTP"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submissions Action Area */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <Link
                href="/"
                className="inline-flex items-center gap-2 justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-brand-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>

              <Button type="submit" disabled={isPending} className="px-6 py-3 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-600/30 transition-all font-semibold">
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating database...
                  </span>
                ) : (
                  "Create Account & Deploy Setup"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          {/* Backdrop with Blur */}
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity duration-300 dark:bg-black/80"
            onClick={() => setModalOpen(false)}
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-2xl transition-all dark:bg-gray-950 border border-gray-100 dark:border-gray-900 animate-in fade-in scale-in duration-200">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Confirm {modalType === "mail" ? "Email Address" : "Phone Number"}
              </h3>
            </div>

            <div className="mt-3.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Is the entered {modalType === "mail" ? "email" : "phone number"} correct?
              </p>
              <p className="mt-3 text-base font-semibold font-mono text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20 px-3 py-2.5 rounded-xl border border-brand-100/50 dark:border-brand-900/30 break-all">
                {modalValue}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleEditNumber}
                className="px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Edit {modalType === "mail" ? "email" : "number"}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSendOtp}
                className="px-4 py-2 text-xs font-bold rounded-lg shadow-md shadow-brand-500/10 cursor-pointer"
              >
                Send OTP
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
