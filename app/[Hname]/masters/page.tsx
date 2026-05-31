import Link from "next/link";
import { mastersData } from "../../../lib/navigation";
import {
  FolderIcon,
  GroupIcon,
  UserCircleIcon,
  BoxCubeIcon,
  BoxIcon,
  DollarLineIcon,
  DocsIcon,
} from "../../../components/icons";

interface Props {
  params: Promise<{ Hname: string }>;
}

export default async function MastersPage({ params }: Props) {
  const resolvedParams = await params;
  const hname = resolvedParams.Hname;

  const mastersItems = mastersData;

  const getIcon = (title: string) => {
    switch (title) {
      case "Clinical Masters":
        return <GroupIcon />;
      case "Consultant Doctor Management":
        return <UserCircleIcon />;
      case "Lab Hospital Facility Masters":
        return <BoxCubeIcon />;
      case "Pharmacy Inventory Masters":
        return <BoxIcon />;
      case "Accounts Finance Masters":
        return <DollarLineIcon />;
      case "Administrative General Masters":
        return <DocsIcon />;
      default:
        return <FolderIcon />;
    }
  };

  return (
    <div className="min-h-full bg-transparent px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mastersItems.map((item, index) => {
          // Determine the correct route for the subgroup boxes page.
          // By default, the href in navigation might point to the first item (e.g. /masters/clinical-masters/symptoms)
          // We want the box to point to the subgroup page itself, so extract base path like /masters/clinical-masters
          let linkHref = item.href ? item.href.split("/").slice(0, 3).join("/") : "#";
          
          if (hname && hname !== "HSMS" && linkHref.startsWith("/") && linkHref !== "/") {
            linkHref = `/${encodeURIComponent(hname)}${linkHref}`;
          }

          return (
            <Link
              key={index}
              href={linkHref}
              className="group flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(37,99,235,0.12)] hover:dark:shadow-[0_12px_30px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 transition-colors duration-200 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {getIcon(item.title)}
              </div>
              <span className="max-w-[14rem] text-lg font-semibold text-blue-500 transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
