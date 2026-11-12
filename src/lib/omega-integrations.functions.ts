import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getEvolutionStatus } from '@/lib/evolution.functions';
import { requireLegacyIntegrationAdmin } from '@/lib/crm/legacy-access';

export const integrationStatus = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireLegacyIntegrationAdmin(context.supabase, context.userId);
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user?.email_confirmed_at) throw new Error('Acesso não autorizado.');

  let evoState = 'Não testado';
  let evoDetail = 'WhatsApp Extra · instância e QR Code';
  const evoConfigured = Boolean(process.env['EVOLUTION_API_KEY']);
  if (evoConfigured) {
    try {
      const evoStatus = await getEvolutionStatus();
      if (evoStatus.state === 'open') {
        evoState = `Conectado (${evoStatus.instance})`;
        evoDetail = `WhatsApp ativo · ${evoStatus.phone || 'Instância conectada'} · ${evoStatus.count} mensagens`;
      } else {
        evoState = evoStatus.state;
        evoDetail = `Instância: ${evoStatus.instance} (${evoStatus.state})`;
      }
    } catch {
      evoState = 'Inacessível';
    }
  }

  return [
    { id: 'anthropic', name: 'Hudson · Gateway Lovable', configured: Boolean(process.env['LOVABLE_API_KEY']), state: 'Não testado', detail: 'Sugestões com revisão humana · A.P.O.N.T.E.' },
    { id: 'twilio', name: 'Twilio', configured: Boolean(process.env['TWILIO_API_KEY']), state: 'Não testado', detail: 'Telefonia · entrada e saída' },
    { id: 'elevenlabs', name: 'ElevenLabs', configured: Boolean(process.env['ELEVENLABS_API_KEY']), state: 'Não testado', detail: 'Voz do Hudson' },
    { id: 'evolution', name: 'Evolution API', configured: evoConfigured, state: evoState, detail: evoDetail },
    { id: 'meta', name: 'Meta', configured: Boolean(process.env['WHATSAPP_API_KEY']), state: 'Não testado', detail: 'WhatsApp Oficial, Instagram e Messenger' },
    { id: 'zernio', name: 'Zernio', configured: Boolean(process.env['ZERNIO_API_KEY']), state: 'Não testado', detail: 'Canais sociais' },
    { id: 'ml', name: 'Mercado Livre', configured: false, state: 'Configuração pendente', detail: 'Aplicativo do vendedor' },
    { id: 'google', name: 'Google', configured: false, state: 'Configuração pendente', detail: 'Agenda, Gmail e anúncios' },
    { id: 'cloudfy', name: 'Cloudfy', configured: false, state: 'Documentação pendente', detail: 'Serviço escolhido · contrato ainda não fornecido' },
    { id: 'erp', name: 'Sistema da loja', configured: false, state: 'Configuração pendente', detail: 'Estoque e clientes · API e webhooks' },
  ];
});
