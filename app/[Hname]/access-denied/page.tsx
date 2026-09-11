"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AccessDeniedContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "";
  const deniedPath = searchParams?.get("path") ?? "";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
        <svg
          className="h-12 w-12 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>

      {/* Heading */}
      <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
        Access Denied
      </h1>

      <p className="mb-2 text-base text-gray-500 dark:text-gray-400">
        You don&apos;t have permission to access this page.
      </p>

      {deniedPath && (
        <p className="mb-8 rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {deniedPath}
        </p>
      )}

      {!deniedPath && <div className="mb-8" />}

      <p className="mb-8 max-w-sm text-sm text-gray-400 dark:text-gray-500">
        If you believe this is a mistake, please contact your administrator to request access.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={hname ? `/${encodeURIComponent(hname)}/masters` : "/"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Go to Dashboard
        </Link>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center" />}>
      <AccessDeniedContent />
    </Suspense>
  );
}
