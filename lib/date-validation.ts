export function validateDateOfBirth(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null; // Let the required field logic handle empty fields if necessary

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return "Invalid date format.";
  }

  const yearStr = parts[0];
  const year = parseInt(yearStr, 10);

  if (yearStr.length !== 4) {
    return "Year must be exactly 4 digits.";
  }

  if (isNaN(year) || year < 1900) {
    return "Please enter a realistic birth year.";
  }

  const inputDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate > today) {
    return "Date of birth cannot be in the future.";
  }

  return null;
}
