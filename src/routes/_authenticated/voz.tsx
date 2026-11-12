import { createFileRoute } from '@tanstack/react-router';
import { meta } from '@/components/pw';
import { VoiceWorkspace } from '@/components/voice/VoiceWorkspace';
export const Route=createFileRoute('/_authenticated/voz')({head:()=>meta('Voz do Hudson','Configuração de voz, comportamento e campanhas de ligações do Hudson no CRM Grupo Ômega.'),component:VoiceWorkspace});
