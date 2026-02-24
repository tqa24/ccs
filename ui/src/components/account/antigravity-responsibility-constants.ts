export const ANTIGRAVITY_ACK_VERSION = '2026-02-24-antigravity-oauth-v1';
export const ANTIGRAVITY_ACK_PHRASE = 'I ACCEPT FULL RESPONSIBILITY';

export interface AntigravityRiskChecklistValue {
  reviewedIssue622: boolean;
  understandsBanRisk: boolean;
  acceptsFullResponsibility: boolean;
  typedPhrase: string;
}

export const DEFAULT_ANTIGRAVITY_RISK_CHECKLIST: AntigravityRiskChecklistValue = {
  reviewedIssue622: false,
  understandsBanRisk: false,
  acceptsFullResponsibility: false,
  typedPhrase: '',
};

export function isAntigravityRiskChecklistComplete(value: AntigravityRiskChecklistValue): boolean {
  return (
    value.reviewedIssue622 &&
    value.understandsBanRisk &&
    value.acceptsFullResponsibility &&
    value.typedPhrase.trim().replace(/\s+/g, ' ').toUpperCase() === ANTIGRAVITY_ACK_PHRASE
  );
}
