"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigationSection } from "../lib/navigation";
import { navigation } from "../lib/navigation";
import { getCurrentUser } from "../app/actions/user";
import {
  BoxCubeIcon,
  BoxIcon,
  CalenderIcon,
  ChevronDownIcon,
  DocsIcon,
  DollarLineIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  UserCircleIcon,
} from "./icons";
import { useSidebar } from "./context/SidebarContext";

type OpenMap = Record<string, boolean>;

function getNodeKey(node: NavigationSection, parentKey = "") {
  return parentKey ? `${parentKey}/${node.title}` : node.title;
}

function collectOpenKeys(
  nodes: NavigationSection[],
  pathname: string,
  parentKey = "",
): string[] {
  for (const node of nodes) {
    const nodeKey = getNodeKey(node, parentKey);
    const directMatch = node.href === pathname;
    const nestedMatch = node.items
      ? collectOpenKeys(node.items, pathname, nodeKey)
      : [];

    if (directMatch || nestedMatch.length > 0) {
      return [nodeKey, ...nestedMatch];
    }
  }

  return [];
}

function getSectionIcon(title: string) {
  switch (title) {
    case "Masters":
      return <GridIcon />;
    case "Pharmacy":
      return <BoxIcon />;
    case "Billing":
      return <DollarLineIcon />;
    case "Pricing":
      return <DollarLineIcon />;
    case "Discount Schema":
      return <DocsIcon />;
    case "Queue Management":
      return <GroupIcon />;
    case "Doctor Consultation":
      return <UserCircleIcon />;
    case "Book Appointment":
      return <CalenderIcon />;
    case "Clinical Masters":
      return <GroupIcon />;
    case "Consultant Doctor Management":
      return <UserCircleIcon />;
    case "Lab Hospital Facility Masters":
      return <BoxCubeIcon />;
    case "Schedule":
      return <CalenderIcon />;
    default:
      return <FolderIcon />;
  }
}

type ItemProps = {
  node: NavigationSection;
  parentKey?: string;
  level?: number;
  pathname: string;
  isCompact: boolean;
  openMap: OpenMap;
  onToggle: (key: string) => void;
  hname?: string;
};

function SidebarItem({
  node,
  parentKey = "",
  level = 0,
  pathname,
  isCompact,
  openMap,
  onToggle,
  hname,
}: ItemProps) {
  const nodeKey = getNodeKey(node, parentKey);
  const hasChildren = Boolean(node.items?.length);
  const isActive = node.href === pathname;
  const isOpen = Boolean(openMap[nodeKey]);
  const icon = level === 0 ? getSectionIcon(node.title) : null;

  // Build local href optionally injecting the [Hname] directory
  let localHref = node.href ?? "#";
  if (hname && hname !== "HSMS" && localHref.startsWith("/") && localHref !== "/") {
    localHref = `/${encodeURIComponent(hname)}${localHref}`;
  }

  if (!hasChildren) {
    return (
      <li>
        <Link
          href={localHref}
          className={`menu-item group ${isActive ? "menu-item-active" : "menu-item-inactive"} ${
            isCompact ? "lg:justify-center" : "lg:justify-start"
          }`}
        >
          {icon ? (
            <span
              className={`${isActive ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}
            >
              {icon}
            </span>
          ) : null}
          {!isCompact ? <span className="truncate">{node.title}</span> : null}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(nodeKey)}
        className={`menu-item group w-full ${isOpen ? "menu-item-active" : "menu-item-inactive"} ${
          isCompact ? "lg:justify-center" : "lg:justify-start"
        }`}
      >
        {icon ? (
          <span className={`${isOpen ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
            {icon}
          </span>
        ) : null}
        {!isCompact ? <span className="truncate">{node.title}</span> : null}
        {!isCompact ? (
          <ChevronDownIcon
            className={`ml-auto h-5 w-5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-brand-500" : "text-gray-500"
            }`}
          />
        ) : null}
      </button>

      {!isCompact ? (
        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "mt-2" : "mt-0"}`}>
          {isOpen ? (
            <ul className={`${level === 0 ? "ml-9" : "ml-4"} space-y-1`}>
              {node.items?.map((child) => (
                <SidebarItem
                  key={getNodeKey(child, nodeKey)}
                  node={child}
                  parentKey={nodeKey}
                  level={level + 1}
                  pathname={pathname}
                  isCompact={isCompact}
                  openMap={openMap}
                  onToggle={onToggle}
                  hname={hname}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "HSMS";
  const encodedHname = encodeURIComponent(hname);
  const normalizedPathname =
    hname && hname !== "HSMS" && pathname.startsWith(`/${encodedHname}/`)
      ? pathname.replace(`/${encodedHname}`, "")
      : pathname;
  const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar();
  const isCompact = !isExpanded && !isHovered && !isMobileOpen;
  
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  useEffect(() => {
    if (hname !== "HSMS") {
      getCurrentUser(hname).then(setCurrentUser).catch(console.error);
    }
  }, [hname]);

  const filteredNavigation = useMemo(() => {
    return navigation.filter(nav => {
      // Hide Manage Users for non-admin
      if (nav.title === "Manage Users" && currentUser !== "admin") {
        return false;
      }
      return true;
    });
  }, [currentUser]);

  const initialOpen = useMemo(
    () => collectOpenKeys(filteredNavigation, normalizedPathname),
    [normalizedPathname, filteredNavigation],
  );
  const [openMap, setOpenMap] = useState<OpenMap>({});
  const syncedPathname = useRef<string>("");

  useEffect(() => {
    if (syncedPathname.current === normalizedPathname) {
      return;
    }

    syncedPathname.current = normalizedPathname;
    setOpenMap((current) => {
      const next = { ...current };

      for (const key of initialOpen) {
        next[key] = true;
      }

      return next;
    });
  }, [initialOpen, normalizedPathname]);

  const handleToggle = (key: string) => {
    setOpenMap((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white px-4 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        isExpanded || isMobileOpen || isHovered ? "w-[290px]" : "w-[90px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => {
        if (!isExpanded) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex py-8 ${isCompact ? "lg:justify-center" : "justify-start"}`}>
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="HSMS home"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-theme-sm">
            {hname.substring(0, 2).toUpperCase()}
          </div>
          {!isCompact ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                {hname}
              </div>
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                Hospital Suite
              </div>
            </div>
          ) : null}
        </Link>
      </div>

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto pb-6">
        <nav className="mb-6">
          <div className="flex flex-col gap-6">
            <div>
              <h2
                className={`mb-4 flex text-xs leading-5 uppercase text-gray-400 ${
                  isCompact ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isCompact ? "..." : "Menu"}
              </h2>
              <ul className="flex flex-col gap-2">
                {filteredNavigation.map((section) => (
                  <SidebarItem
                    key={section.title}
                    node={section}
                    pathname={normalizedPathname}
                    isCompact={isCompact}
                    openMap={openMap}
                    onToggle={handleToggle}
                    hname={hname}
                  />
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}
