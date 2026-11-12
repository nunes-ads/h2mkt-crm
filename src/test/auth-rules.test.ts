import { describe, expect, it } from 'vitest';
import { safeReturnPath, canEnterPlatform } from '@/lib/auth-rules';
describe('Acesso da equipe', () => {
  it('exige identidade com e-mail confirmado', () => { expect(canEnterPlatform(null)).toBe(false); expect(canEnterPlatform({ email_confirmed_at: null })).toBe(false); expect(canEnterPlatform({ email_confirmed_at: '2026-11-09T04:00:00Z' })).toBe(true); });
  it('não permite redirecionamento para outro site', () => { expect(safeReturnPath('https://evil.example')).toBe('/painel'); expect(safeReturnPath('//evil.example')).toBe('/painel'); expect(safeReturnPath('/\\evil.example')).toBe('/painel'); expect(safeReturnPath('/canais')).toBe('/canais'); });
});