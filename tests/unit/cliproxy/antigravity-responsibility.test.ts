import { describe, expect, it } from 'bun:test';
import {
  ANTIGRAVITY_ACK_PHRASE,
  ANTIGRAVITY_ACK_VERSION,
  hasAntigravityRiskAcceptanceFlag,
  validateAntigravityRiskAcknowledgement,
} from '../../../src/cliproxy/antigravity-responsibility';

describe('antigravity-responsibility', () => {
  it('accepts a complete acknowledgement payload', () => {
    const result = validateAntigravityRiskAcknowledgement({
      version: ANTIGRAVITY_ACK_VERSION,
      reviewedIssue622: true,
      understandsBanRisk: true,
      acceptsFullResponsibility: true,
      typedPhrase: ANTIGRAVITY_ACK_PHRASE,
    });

    expect(result.valid).toBeTrue();
  });

  it('accepts phrase with extra spacing and lowercase', () => {
    const result = validateAntigravityRiskAcknowledgement({
      version: ANTIGRAVITY_ACK_VERSION,
      reviewedIssue622: true,
      understandsBanRisk: true,
      acceptsFullResponsibility: true,
      typedPhrase: '  i   accept   full responsibility  ',
    });

    expect(result.valid).toBeTrue();
  });

  it('rejects payload when checklist steps are not fully completed', () => {
    const result = validateAntigravityRiskAcknowledgement({
      version: ANTIGRAVITY_ACK_VERSION,
      reviewedIssue622: true,
      understandsBanRisk: false,
      acceptsFullResponsibility: true,
      typedPhrase: ANTIGRAVITY_ACK_PHRASE,
    });

    expect(result.valid).toBeFalse();
    expect(result.error).toContain('checklist');
  });

  it('rejects payload when version is outdated', () => {
    const result = validateAntigravityRiskAcknowledgement({
      version: 'older-version',
      reviewedIssue622: true,
      understandsBanRisk: true,
      acceptsFullResponsibility: true,
      typedPhrase: ANTIGRAVITY_ACK_PHRASE,
    });

    expect(result.valid).toBeFalse();
    expect(result.error).toContain('version');
  });

  it('rejects payload when phrase does not match', () => {
    const result = validateAntigravityRiskAcknowledgement({
      version: ANTIGRAVITY_ACK_VERSION,
      reviewedIssue622: true,
      understandsBanRisk: true,
      acceptsFullResponsibility: true,
      typedPhrase: 'I AGREE',
    });

    expect(result.valid).toBeFalse();
    expect(result.error).toContain('phrase');
  });

  it('detects explicit antigravity acceptance flags', () => {
    expect(hasAntigravityRiskAcceptanceFlag(['--accept-agr-risk'])).toBeTrue();
    expect(hasAntigravityRiskAcceptanceFlag(['--accept-antigravity-risk'])).toBeTrue();
    expect(hasAntigravityRiskAcceptanceFlag(['--auth'])).toBeFalse();
  });
});
