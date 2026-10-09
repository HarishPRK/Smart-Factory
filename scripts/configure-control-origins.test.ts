import { describe, expect, it } from 'vitest';
import { mergeControlOrigins } from './configure-control-origins.mjs';

describe('command origin deployment configuration', () => {
  it('adds the exact EC2 origin and preserves existing dashboard origins only', () => {
    const text = mergeControlOrigins(['SECRET=do-not-export\nCONTROL_ALLOWED_ORIGINS="https://factory.example,http://localhost:5174" # existing\nOTHER=value', 'CONTROL_ALLOWED_ORIGINS=http://3.239.12.96/'], ['http://3.239.12.96']);
    expect(text).toBe('CONTROL_ALLOWED_ORIGINS=https://factory.example,http://localhost:5174,http://3.239.12.96\n');
    expect(text).not.toContain('SECRET');
  });
  it('supports an absent origin assignment without touching other environment settings', () => {
    expect(mergeControlOrigins(['TOKEN=value'], ['http://3.239.12.96'])).toBe('CONTROL_ALLOWED_ORIGINS=http://3.239.12.96\n');
  });
  it.each(['*', 'null', 'http://host/path', 'http://user:pass@host', 'http://host\nOTHER=1'])('rejects unsafe configuration: %s', value => {
    expect(() => mergeControlOrigins([], [value])).toThrow();
  });
  it('requires an explicit dashboard origin', () => {
    expect(() => mergeControlOrigins([], [])).toThrow();
  });
});
