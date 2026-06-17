/**
 * Returns the appropriate salutation based on gender and optional marital status.
 *  - Male                      → "Mr."
 *  - Female + married          → "Mrs."
 *  - Female + unmarried/other  → "Ms."
 *  - Unknown                   → ""
 */
export function getSalutation(gender: string, maritalStatus?: string): string {
  const g = (gender ?? "").trim().toLowerCase();
  if (g === "male" || g === "m") return "Mr.";
  if (g === "female" || g === "f") {
    const ms = (maritalStatus ?? "").trim().toLowerCase();
    return ms === "married" ? "Mrs." : "Ms.";
  }
  return "";
}

/**
 * Prefixes the name with the correct salutation if one can be derived.
 * Returns the original name unchanged when gender is unknown.
 */
export function withSalutation(name: string, gender: string, maritalStatus?: string): string {
  if (!name) return name;
  const salutation = getSalutation(gender, maritalStatus);
  if (!salutation) return name;
  // Avoid double-prefixing
  if (name.startsWith("Mr.") || name.startsWith("Ms.") || name.startsWith("Mrs.") || name.startsWith("Dr.")) {
    return name;
  }
  return `${salutation} ${name}`;
}
