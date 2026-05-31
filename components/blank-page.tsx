"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mastersData } from "../lib/navigation";

type BlankPageProps = {
  title: string;
  children?: React.ReactNode;
};

export function BlankPage({ title, children }: BlankPageProps) {
  const pathname = usePathname();
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "";
  const tabsRef = useRef<HTMLDivElement>(null);
  const [hasTabOverflow, setHasTabOverflow] = useState(false);

  // Normalize pathname to remove hname for matching with static definitions
  let normalizedPathname = pathname;
  if (hname && hname !== "HSMS" && pathname.startsWith(`/${encodeURIComponent(hname)}/`)) {
    normalizedPathname = pathname.replace(`/${encodeURIComponent(hname)}`, "");
  } else if (hname === "HSMS" || !hname) {
      // Nothing needed, match as is
  }

  const matchedGroup = mastersData.find((group) =>
    group.items?.some((item) => item.href === normalizedPathname),
  );

  useEffect(() => {
    const tabList = tabsRef.current;

    if (!tabList) {
      return;
    }

    const updateTabOverflow = () => {
      setHasTabOverflow(tabList.scrollWidth > tabList.clientWidth);
    };

    updateTabOverflow();

    const resizeObserver = new ResizeObserver(updateTabOverflow);
    resizeObserver.observe(tabList);
    window.addEventListener("resize", updateTabOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateTabOverflow);
    };
  }, [matchedGroup?.items?.length]);

  const scrollTabs = (direction: "left" | "right") => {
    tabsRef.current?.scrollBy({
      left: direction === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  return (
    <main className="min-h-full bg-[#f3f4f6] dark:bg-transparent px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="sr-only">{title}</h1>
      <div className="space-y-6">
        {matchedGroup ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white/90">
                {matchedGroup.title}
              </h2>
            </div>

            <div
              className={`flex min-w-0 max-w-full items-center rounded-2xl bg-slate-200/70 dark:bg-gray-800 p-1.5 ${
                hasTabOverflow ? "w-full lg:flex-1" : "w-fit"
              }`}
            >
              {hasTabOverflow ? (
                <button
                  type="button"
                  aria-label="Scroll tabs left"
                  onClick={() => scrollTabs("left")}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  &lt;
                </button>
              ) : null}

              <div
                ref={tabsRef}
                className="flex max-w-full flex-1 flex-nowrap gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {matchedGroup.items?.map((item) => {
                  const isActive = item.href === normalizedPathname;
                  
                  let localHref = item.href ?? "#";
                  if (hname && hname !== "HSMS" && localHref.startsWith("/") && localHref !== "/") {
                    localHref = `/${encodeURIComponent(hname)}${localHref}`;
                  }

                  return (
                    <Link
                      key={item.href}
                      href={localHref}
                      className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                        isActive
                          ? "border border-slate-200 bg-white dark:bg-gray-700 dark:border-gray-600 text-slate-900 dark:text-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                          : "border border-transparent bg-transparent text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-white/90"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>

              {hasTabOverflow ? (
                <button
                  type="button"
                  aria-label="Scroll tabs right"
                  onClick={() => scrollTabs("right")}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  &gt;
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {children ? <div>{children}</div> : null}
      </div>
    </main>
  );
}
