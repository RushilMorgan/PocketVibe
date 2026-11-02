import { describe, expect, it } from 'vitest';
import { subscribedWithKey, urlBase64ToUint8Array } from './push-key';

const KEY_A = 'BBQ6KC0wZSTz46hP9c-e_Z-Ht110iGGg9R0xnLHP6i2dOLx4NG_OnYXjuN0KBOYNsAHQwsjHj13JeVhpEAayV3k';
const KEY_B = 'BAjHSjdn49y5c-e_Z-Ht110iGGg9R0xnLHP6i2dOLx4NG_OnYXjuN0KBOYNsAHQwsjHj13JeVhpEAayV3kAAAA';

describe('urlBase64ToUint8Array', () => {
  it('decodes a 65-byte uncompressed P-256 public key', () => {
    const bytes = urlBase64ToUint8Array(KEY_A);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });
});

describe('subscribedWithKey', () => {
  it('matches a subscription made with the same key', () => {
    expect(subscribedWithKey(urlBase64ToUint8Array(KEY_A).buffer, KEY_A)).toBe(true);
  });

  it('rejects a subscription made with another key', () => {
    expect(subscribedWithKey(urlBase64ToUint8Array(KEY_B).buffer, KEY_A)).toBe(false);
  });

  it('rejects a subscription with no key recorded', () => {
    expect(subscribedWithKey(null, KEY_A)).toBe(false);
  });
});
