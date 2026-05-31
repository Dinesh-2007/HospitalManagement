"use server";

import { createTenantDbIfNotExists, getSafeDbName } from "../../lib/db";
import { redirect } from "next/navigation";

export async function createAccountAction(formData: FormData) {
  const hospitalName = String(formData.get("hospitalName") ?? "").trim();
  const siteName = String(formData.get("siteName") ?? "").trim();
  
  if (!hospitalName || !siteName) {
    throw new Error("Hospital name and site name are required.");
  }

  // Generate DB based on hospital name safely
  await createTenantDbIfNotExists(siteName);
  
  // Use the desired siteName as the routing identifier
  const tenantRoute = encodeURIComponent(siteName);

  // Redirect user to the new site's space (simulating an automated login sequence setup)
  redirect(`/${tenantRoute}/masters`);
}
