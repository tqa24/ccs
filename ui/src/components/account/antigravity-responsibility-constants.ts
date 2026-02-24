export const ANTIGRAVITY_ACK_VERSION = '2026-02-24-antigravity-oauth-v2';
export const ANTIGRAVITY_ACK_PHRASE = 'I ACCEPT AGY RISK';

export interface AntigravityRiskChecklistValue {
  reviewedIssue509: boolean;
  understandsBanRisk: boolean;
  acceptsFullResponsibility: boolean;
  typedPhrase: string;
}

export const DEFAULT_ANTIGRAVITY_RISK_CHECKLIST: AntigravityRiskChecklistValue = {
  reviewedIssue509: false,
  understandsBanRisk: false,
  acceptsFullResponsibility: false,
  typedPhrase: '',
};

export function isAntigravityRiskChecklistComplete(value: AntigravityRiskChecklistValue): boolean {
  return (
    value.reviewedIssue509 &&
    value.understandsBanRisk &&
    value.acceptsFullResponsibility &&
    value.typedPhrase.trim().replace(/\s+/g, ' ').toUpperCase() === ANTIGRAVITY_ACK_PHRASE
  );
}
