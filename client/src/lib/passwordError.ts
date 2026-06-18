// Detects Supabase Auth "leaked password" rejections so we can show a clear,
// friendly message instead of GoTrue's terse wording.
//
// When "leaked password protection" is enabled (Supabase → Authentication →
// Attack Protection), signUp / updateUser reject passwords found in the
// HaveIBeenPwned breach corpus. The Supabase client surfaces this as a
// `weak_password` error, sometimes with a `reasons` array containing "pwned".

export const PWNED_PASSWORD_MESSAGE =
  "The password you've chosen has appeared in a known data breach, so it isn't safe to use. Please pick a different one.";

export function isLeakedPasswordError(error: any): boolean {
  if (!error) return false;
  const code = error.code ?? error.error_code ?? "";
  const reasons: string[] = Array.isArray(error.reasons) ? error.reasons : [];
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "weak_password" ||
    reasons.includes("pwned") ||
    /pwned|leaked|compromis|data breach|known to be weak/.test(msg)
  );
}
