"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser } from "../../app/actions/user";
import { logoutAction } from "../../app/actions/auth";
import { changePasswordAction } from "../../app/actions/user-settings";
import { Dropdown } from "../dropdown";
import { DropdownItem } from "../dropdown-item";
import { ChevronDownIcon } from "../icons";
import { Button } from "../ui/button";
import { InputField } from "../ui/input-field";
import { Label } from "../ui/label";

export function HeaderUserDropdown() {
  const params = useParams();
  const router = useRouter();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : "HSMS";
  const [user, setUser] = useState<string | null>(null);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  useEffect(() => {
    if (hname !== "HSMS") {
      getCurrentUser(hname).then(setUser).catch(console.error);
    }
  }, [hname]);

  if (!user) return null;

  async function handleLogout() {
    await logoutAction(hname);
    window.location.href = `/${encodeURIComponent(hname)}`;
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChangePasswordError("");
    const formData = new FormData(e.currentTarget);
    try {
      await changePasswordAction(hname, formData);
      setChangePasswordModalOpen(false);
      alert("Password changed successfully!");
    } catch (err: any) {
      setChangePasswordError(err.message || "Failed to change password");
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((c) => !c)}
          className="dropdown-toggle flex cursor-pointer items-center gap-3"
        >
          <div className="relative h-11 w-11 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-600">
            {user.substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {user}
            </span>
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </button>

        <Dropdown isOpen={isDropdownOpen} onClose={() => setDropdownOpen(false)} className="absolute right-0 top-full mt-2 w-48 bg-white shadow-lg border border-gray-200 rounded z-50">
          <DropdownItem onClick={() => setChangePasswordModalOpen(true)}>Change Password</DropdownItem>
          <DropdownItem onClick={handleLogout} className="text-red-600">Logout</DropdownItem>
        </Dropdown>
      </div>

      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="mb-4 text-xl font-semibold">Change Password</h2>
            {changePasswordError && (
              <div className="mb-4 text-red-500 text-sm">{changePasswordError}</div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword">Old Password</Label>
                <InputField id="oldPassword" name="oldPassword" type="password" required />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <InputField id="newPassword" name="newPassword" type="password" required />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setChangePasswordModalOpen(false)}>Cancel</Button>
                <Button type="submit">Change Password</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
