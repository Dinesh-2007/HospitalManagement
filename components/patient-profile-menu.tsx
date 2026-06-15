"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PatientProfileMenu({ isOpen, onClose, hname }: { isOpen: boolean; onClose: () => void; hname?: string }) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogout = () => {
    try {
      localStorage.removeItem("patientName");
    } catch (e) {}
    onClose();
    router.push("/");
  };

  const getHref = (path: string) => {
    return hname ? `/${encodeURIComponent(hname)}${path}` : path;
  };

  return (
    <div className="fixed right-4 top-16 z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <ul className="flex flex-col gap-2">
        <li>
          <Link href={getHref("/patient-book-appointment")} onClick={onClose} className="block rounded px-3 py-2 hover:bg-gray-50">
            Book Appointment
          </Link>
        </li>
        <li>
          <Link href={getHref("/patient-appointments")} onClick={onClose} className="block rounded px-3 py-2 hover:bg-gray-50">
            My appointments
          </Link>
        </li>
        <li>
          <Link href={getHref("/manage-family")} onClick={onClose} className="block rounded px-3 py-2 hover:bg-gray-50">
            Manage Family member
          </Link>
        </li>
        <li>
          <Link href={getHref("/patient-registration?mode=edit")} onClick={onClose} className="block rounded px-3 py-2 hover:bg-gray-50">
            EDIT PROFILE
          </Link>
        </li>
        <li>
          <button onClick={handleLogout} className="w-full text-left rounded px-3 py-2 hover:bg-gray-50">
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
}
