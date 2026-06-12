export const USER_MANAGER_EMAILS = new Set([
  "ana.gomes@visagio.com",
  "gabriel.cavalcanti@visagio.com",
  "paulo.rosado@visagio.com",
  "sophia.gallindo@visagio.com",
  "thomaz.lima@visagio.com",
]);

export function canManageUsers(email: string | null | undefined) {
  return USER_MANAGER_EMAILS.has(email?.trim().toLowerCase() ?? "");
}
