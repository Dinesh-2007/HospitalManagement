"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "../../../../../components/page-layout";

function DeleteBuildingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hname = (params?.Hname as string) || "";
  const buildingId = searchParams.get("id") || "";
  const buildingName = searchParams.get("name") || "Building";
  const buildingCode = searchParams.get("code") || "";
  const isDb = searchParams.get("isDb") === "true";

  // Form State
  const [reasonCategory, setReasonCategory] = useState("Structural Renovation");
  const [detailedReason, setDetailedReason] = useState("");
  const [email, setEmail] = useState("");
  
  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [userOtp, setUserOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [otpError, setOtpError] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // Status & Confirmation State
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Handle Send OTP
  const handleSendOtp = () => {
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address before sending OTP.");
      return;
    }
    setErrorMsg(null);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpSent(true);
    setTimer(60);
    setUserOtp("");
    setOtpVerified(false);
    setOtpError(false);
  };

  // Handle Verify OTP
  const handleVerifyOtp = (inputCode: string) => {
    setUserOtp(inputCode);
    if (inputCode.length === 6) {
      if (inputCode === generatedOtp) {
        setOtpVerified(true);
        setOtpError(false);
        setErrorMsg(null);
      } else {
        setOtpVerified(false);
        setOtpError(true);
      }
    } else {
      setOtpVerified(false);
      setOtpError(false);
    }
  };

  // Handle Delete Action
  const handleDeleteBuilding = async () => {
    if (!detailedReason.trim() || detailedReason.trim().length < 5) {
      setErrorMsg("Please provide a detailed reason (at least 5 characters).");
      return;
    }
    if (!otpVerified) {
      setErrorMsg("Please complete OTP email verification first.");
      return;
    }
    if (!confirmCheckbox) {
      setErrorMsg("Please confirm the warning checkbox before proceeding.");
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      if (isDb && hname && buildingId) {
        const res = await fetch(`/api/${hname}/infrastructure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteBuilding", id: buildingId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete building from database.");
        }
      }

      // Update sessionStorage for wizard buildings
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem("wizard_buildings");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const updated = parsed.filter((b: { id: string }) => b.id !== buildingId);
              sessionStorage.setItem("wizard_buildings", JSON.stringify(updated));
            }
          } catch {
            /* ignore */
          }
        }
      }

      setDeleteSuccess(true);
      setTimeout(() => {
        router.push(`/${hname}/bed-management/infrastructure`);
      }, 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error deleting building.");
      setIsDeleting(false);
    }
  };

  return (
    <PageLayout title="Delete Hospital Building">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Back Link */}
        <div>
          <button
            type="button"
            onClick={() => router.push(`/${hname}/bed-management/infrastructure`)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition"
          >
            ← Back to Infrastructure Designer
          </button>
        </div>

        {/* Success Banner */}
        {deleteSuccess ? (
          <div className="rounded-2xl border border-green-300 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/40 space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-300 text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-lg font-bold text-green-900 dark:text-green-200">
              Building Successfully Deleted
            </h3>
            <p className="text-xs text-green-700 dark:text-green-400">
              Building <strong>{buildingName}</strong> ({buildingCode || "N/A"}) has been permanently deleted. Redirecting...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Warning Alert Banner */}
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 dark:border-red-900/60 dark:bg-red-950/30 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xl font-bold shrink-0">
                ⚠️
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                  Critical Action: Building Permanent Deletion
                </h4>
                <p className="text-xs text-red-700 dark:text-red-300/80 leading-relaxed">
                  You are initiating the complete removal of <strong>{buildingName}</strong> ({buildingCode || "BLD"}). This operation will remove all associated floor maps, department assignments, and room allocations. Verification is required.
                </p>
              </div>
            </div>

            {/* Target Building Info Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Target Building Profile
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] text-gray-500 block font-medium">Building Name</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{buildingName}</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] text-gray-500 block font-medium">Building Code</span>
                  <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">{buildingCode || "N/A"}</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] text-gray-500 block font-medium">System ID</span>
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate block">{buildingId}</span>
                </div>
              </div>
            </div>

            {/* Step 1: Deletion Reason */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                  Step 1: Specify Reason for Deleting
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select a category and provide a brief explanation for auditing purposes.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Reason Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="Structural Renovation">Structural Renovation / Demolition</option>
                    <option value="Space Re-allocation">Space Re-allocation & Infrastructure Shift</option>
                    <option value="Building Decommissioned">Building Decommissioned</option>
                    <option value="Created by Mistake">Created by Mistake / Duplicate Entry</option>
                    <option value="Other">Other Administrative Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Detailed Explanation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={detailedReason}
                    onChange={(e) => setDetailedReason(e.target.value)}
                    placeholder="Enter detailed reason why this building block needs to be removed from hospital structure..."
                    className="w-full rounded-xl border border-gray-300 bg-white p-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Email & OTP Verification */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                  Step 2: Email & OTP Security Verification
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verify your authorized administrator email address before executing permanent deletion.
                </p>
              </div>

              <div className="space-y-4">
                {/* Email Input & Send OTP Button */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Authorized Admin Email <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@hospital.com"
                      className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={timer > 0}
                      className="px-4 py-2 rounded-xl bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition shrink-0 shadow-xs"
                    >
                      {timer > 0 ? `Resend OTP (${timer}s)` : otpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>
                </div>

                {/* Simulated OTP Notification Banner for Testing */}
                {otpSent && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs font-medium space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">📧 OTP Verification Code Sent!</span>
                      <span className="text-[10px] bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded font-mono">
                        Expires in {timer}s
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      Code sent to <strong>{email}</strong>. For demonstration, your OTP code is:
                      <span className="ml-2 px-2 py-0.5 bg-white dark:bg-gray-900 font-mono font-bold text-brand-600 dark:text-brand-400 rounded border border-blue-300 dark:border-blue-700">
                        {generatedOtp}
                      </span>
                    </p>
                  </div>
                )}

                {/* OTP Code Input */}
                {otpSent && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Enter 6-Digit OTP Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        value={userOtp}
                        onChange={(e) => handleVerifyOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className={`h-11 w-48 rounded-xl border text-center font-mono text-base font-bold tracking-widest bg-white dark:bg-gray-900 dark:text-white focus:outline-none transition ${
                          otpVerified
                            ? "border-green-500 ring-2 ring-green-500/20 text-green-600"
                            : otpError
                            ? "border-red-500 ring-2 ring-red-500/20 text-red-600"
                            : "border-gray-300 dark:border-gray-700 focus:border-brand-500"
                        }`}
                      />
                      {otpVerified && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                          ✓ OTP Verified Successfully
                        </span>
                      )}
                      {otpError && (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          ✕ Invalid OTP code. Please re-check.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Confirmation & Final Submit */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheckbox}
                  onChange={(e) => setConfirmCheckbox(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-normal">
                  I confirm that I want to delete building <strong>{buildingName}</strong>. I understand that this action will remove all configuration data and cannot be undone.
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => router.push(`/${hname}/bed-management/infrastructure`)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBuilding}
                  disabled={!otpVerified || !confirmCheckbox || isDeleting}
                  className="px-6 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 transition shadow-sm inline-flex items-center gap-2"
                >
                  {isDeleting ? "Deleting Building..." : "Verify & Delete Building"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function DeleteBuildingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading deletion form...</div>}>
      <DeleteBuildingContent />
    </Suspense>
  );
}
