import { describe, expect, it } from 'vitest';
import { campaignError, newVoiceCampaign } from '@/lib/omega-voz';
describe('Rascunhos de campanha de voz',()=>{
 it('exige nome antes de avançar',()=>{const c=newVoiceCampaign();expect(campaignError(c,0)).not.toBe('');c.nome='Retorno óleo';expect(campaignError(c,0)).toBe('');});
 it('exige número de origem',()=>{const c=newVoiceCampaign();expect(campaignError(c,1)).not.toBe('');c.numero='numero-local';expect(campaignError(c,1)).toBe('');});
 it('exige contato para preparar a campanha',()=>{const c=newVoiceCampaign();expect(campaignError(c,3)).not.toBe('');c.contatos=['contato-local'];expect(campaignError(c,3)).toBe('');});
 it('rejeita janela invertida e limites fora do intervalo do protótipo',()=>{const c=newVoiceCampaign();expect(campaignError(c,4)).toBe('');c.inicio='18:00';c.fim='09:00';expect(campaignError(c,4)).not.toBe('');c.inicio='09:00';c.fim='18:00';c.simultaneas=11;expect(campaignError(c,4)).not.toBe('');c.simultaneas=10;c.tentativas=6;expect(campaignError(c,4)).not.toBe('');c.tentativas=5;c.intervalo=14;expect(campaignError(c,4)).not.toBe('');});
});