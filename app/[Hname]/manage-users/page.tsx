import { checkIsAdmin, fetchUsers, addUser, removeUser, changeUserPassword } from "../../actions/manage-users";
import { ComponentCard } from "../../../components/component-card";
import { InputField } from "../../../components/ui/input-field";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { revalidatePath } from "next/cache";

export default async function ManageUsersPage({ params }: { params: Promise<{ Hname: string }> }) {
  const resolvedParams = await params;
  const hname = decodeURIComponent(resolvedParams.Hname);
  
  const isAdmin = await checkIsAdmin(hname);
  if (!isAdmin) {
    return <div className="p-4 text-error-500">Access Denied</div>;
  }

  const users = await fetchUsers(hname);

  async function handleAddUser(formData: FormData) {
    "use server";
    await addUser(hname, formData);
    revalidatePath(`/${hname}/manage-users`);
  }

  async function handleRemoveUser(formData: FormData) {
    "use server";
    await removeUser(hname, formData);
    revalidatePath(`/${hname}/manage-users`);
  }

  async function handleChangePassword(formData: FormData) {
    "use server";
    await changeUserPassword(hname, formData);
    revalidatePath(`/${hname}/manage-users`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Manage Users</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <ComponentCard title="Users List">
          <ul className="space-y-4">
            {users.map((u: any) => (
              <li key={u.id} className="p-4 border rounded shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="font-bold">{u.username}</div>
                  <div className="text-xs text-gray-500">ID: {u.id}</div>
                </div>
                <div className="flex gap-2 items-start">
                  <form action={handleChangePassword} className="flex gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <InputField name="password" placeholder="New Password" type="text" className="w-32" required />
                    <Button type="submit" size="sm">Change Pwd</Button>
                  </form>
                  {u.username !== 'admin' && (
                    <form action={handleRemoveUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <Button type="submit" size="sm" variant="outline" className="text-red-500 hover:text-red-700">Remove</Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </ComponentCard>
        
        <ComponentCard title="Add New User">
          <form action={handleAddUser} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <InputField id="username" name="username" placeholder="Username" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <InputField id="password" name="password" type="password" placeholder="Password" required />
            </div>
            <Button type="submit">Add User</Button>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
}
