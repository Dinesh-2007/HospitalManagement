import { redirect } from "next/navigation";

export default function SuperAdminIndexPage() {
  redirect("/SuperAdmin/tenants");
}
