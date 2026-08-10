export const TERMS_VERSION = "2026-08-10";
export const PRIVACY_VERSION = "2026-08-10";

export interface LegalAcceptanceVersions {
  termsVersion: string;
  privacyVersion: string;
}

export const CURRENT_LEGAL_ACCEPTANCE: LegalAcceptanceVersions = Object.freeze({
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
});
