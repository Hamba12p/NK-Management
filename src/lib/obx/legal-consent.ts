export type LegalConsentRecord = {
  legal_version: string
  privacy_accepted_at: string | null
  mou_accepted_at: string | null
}

export function isCurrentLegalConsent(record: LegalConsentRecord | null | undefined, version: string): boolean {
  return record?.legal_version === version
    && typeof record.privacy_accepted_at === 'string'
    && typeof record.mou_accepted_at === 'string'
}

export function makeLegalConsentRecord(
  volunteerId: string,
  legalVersion: string,
  privacyAccepted: boolean,
  mouAccepted: boolean,
  acceptedAt = new Date().toISOString(),
) {
  if (!privacyAccepted || !mouAccepted) return null
  return {
    roster_id: volunteerId,
    privacy_accepted_at: acceptedAt,
    mou_accepted_at: acceptedAt,
    legal_version: legalVersion,
  }
}
