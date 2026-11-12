import { createFileRoute } from '@tanstack/react-router';
import { meta } from '@/components/pw';
import { VoiceWorkspace } from '@/components/voice/VoiceWorkspace';
export const Route=createFileRoute('/_authenticated/ligacoes')({head:()=>meta('Ligações','Central de voz do Hudson: histórico, transcrições, campanhas, números e ajustes de telefonia do CRM Grupo Ômega.'),component:VoiceWorkspace});
