// Turn a Stripe Identity `last_error` into friendly, specific copy.
//
// Stripe returns machine codes like `document_unverified_other` or
// `selfie_face_mismatch` (and sometimes a terse `reason` string). Showing those
// raw — "Stripe couldn't verify it (document unverified other)" — is confusing
// and a little scary. Map the known codes to a short, human explanation of what
// went wrong. The verify card appends its own next-step ("Retry with a clear,
// well-lit photo…"), so each message just explains the cause.

export interface StripeVerifyLastError {
  code?: string | null;
  reason?: string | null;
}

const MESSAGES: Record<string, string> = {
  // Document problems
  document_expired: "Your ID looks expired — use one that's still valid.",
  document_type_not_supported: "That document type isn't supported — try a passport or driver licence.",
  document_unverified_other: "We couldn't read your ID clearly.",
  document_manipulated: "We couldn't verify your ID — make sure it's the original, not a photo of a screen.",
  // Selfie problems
  selfie_document_missing_photo: "We couldn't match your selfie to the photo on your ID.",
  selfie_face_mismatch: "Your selfie didn't match the photo on your ID.",
  selfie_unverified_other: "We couldn't verify your selfie.",
  selfie_manipulated: "We couldn't verify your selfie — take a fresh photo rather than uploading one.",
  // ID-number problems
  id_number_mismatch: "The details on your ID didn't match.",
  id_number_unverified_other: "We couldn't verify the details on your ID.",
  id_number_insufficient_document_data: "We couldn't read enough detail from your ID.",
  // Flow / eligibility problems (a better photo won't fix these)
  consent_declined: "Verification needs your consent to go ahead.",
  under_supported_age: "You need to be 18 or older to verify.",
  country_not_supported: "ID verification isn't available in your country yet.",
  device_unsupported: "Your device isn't supported for verification — try another phone or computer.",
  abandoned: "Looks like verification was left unfinished.",
};

// Codes where retrying with a clearer photo is NOT the right advice.
const NOT_PHOTO_FIXABLE = new Set([
  "consent_declined",
  "under_supported_age",
  "country_not_supported",
  "device_unsupported",
]);

export function friendlyVerifyReason(lastError?: StripeVerifyLastError | null): string {
  const code = lastError?.code || undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Unknown code (or only a freeform reason): keep it calm and generic.
  return "We couldn't verify your ID this time.";
}

// True when "retry with a clearer photo" is sensible advice for this error.
export function verifyIsPhotoFixable(lastError?: StripeVerifyLastError | null): boolean {
  return !(lastError?.code && NOT_PHOTO_FIXABLE.has(lastError.code));
}
