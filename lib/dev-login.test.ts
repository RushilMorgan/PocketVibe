import { describe, expect, it } from 'vitest';
import { devLoginEmail } from './dev-login';

describe('devLoginEmail', () => {
  it('passes in next dev on localhost with an email set', () => {
    expect(devLoginEmail('development', 'localhost', ' Me@Example.com ')).toBe('me@example.com');
    expect(devLoginEmail('development', '127.0.0.1', 'me@example.com')).toBe('me@example.com');
    expect(devLoginEmail('development', 'app.localhost', 'me@example.com')).toBe('me@example.com');
  });

  it('never passes in production', () => {
    expect(devLoginEmail('production', 'localhost', 'me@example.com')).toBeNull();
    expect(devLoginEmail(undefined, 'localhost', 'me@example.com')).toBeNull();
  });

  it('never passes on a real host', () => {
    expect(devLoginEmail('development', 'heytoolie.com', 'me@example.com')).toBeNull();
    expect(devLoginEmail('development', 'localhost.evil.com', 'me@example.com')).toBeNull();
  });

  it('needs DEV_LOGIN_EMAIL', () => {
    expect(devLoginEmail('development', 'localhost', undefined)).toBeNull();
    expect(devLoginEmail('development', 'localhost', '  ')).toBeNull();
  });
});
