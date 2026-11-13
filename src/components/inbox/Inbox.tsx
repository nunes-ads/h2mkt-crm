import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouteContext } from "@tanstack/react-router";
import { mergeWhatsAppHistory, whatsappPhone } from "@/lib/whatsapp-history";
import { whatsappDate, whatsappDayKey, whatsappDayLabel, whatsappHour, whatsappListTime, whatsappMessageTime } from "@/lib/whatsapp-time";
import { whatsappName } from "@/lib/whatsapp-profiles";
import { useWhatsAppConnection } from "@/hooks/use-whatsapp-connection";
import { WHATSAPP_POLL_INTERVAL, whatsappErrorMessage, whatsappStatusLabel } from "@/lib/whatsapp-connection";
import { useDeals } from "@/lib/omega-demo";
import { useActiveAccount, type Subconta } from "@/lib/omega-accounts";
import {
  getEvolutionChats,
  getEvolutionMessages,
  sendEvolutionMessage,
  sendEvolutionMedia,
  sendEvolutionAudio,
  sendEvolutionReaction,
  markEvolutionChatAsRead,
  type EvolutionStatusResponse,
} from "@/lib/evolution.functions";
import {
  ETAPAS,
  FILTROS,
  ESTADOS_ATENDIMENTO,
  MOTIVOS_PERDA,
  aguardandoResposta,
  brl,
  filtrarConversas,
  iniciais,
  passaFiltro,
  tempoCurto,
  ultimaMsg,
  type Conversa,
  type Filtro,
  type Mensagem,
} from "./dados";
import { generateAiChatbotResponse, parseAiOutput, parseSuggestions, getAiKeyStatus, saveAiApiKey } from "@/lib/omega-chat.functions";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Bot,
  BrainCircuit,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  FileText,
  Filter,
  Folder,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

// Web Audio API Synthesized Beep (igual ao projeto GPT original)
function playWebAudioBeep(volume = 0.4) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * 0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn("AudioContext error:", err);
  }
}

export type WaTag = {
  id: string;
  name: string;
  color: string;
};

export type WaQuickReply = {
  id: string;
  shortcut: string;
  text: string;
};

export type WaJob = {
  id: string;
  jid: string;
  contatoNome: string;
  kind: "message" | "reminder";
  text: string;
  at: number; // timestamp
  status: "queued" | "done" | "cancelled" | "failed";
  error?: string;
  createdAt: number;
};

export type WaAutomation = {
  greeting: { enabled: boolean; text: string };
  away: { enabled: boolean; text: string; start: string; end: string; days: number[] };
};

export type WaPreferences = {
  sound: boolean;
  volume: number;
  popup: boolean;
  preview: boolean;
  theme: "light" | "dark";
  font: "small" | "normal" | "large";
};

export type WaPopupNotice = {
  id: string;
  title: string;
  text: string;
  jid?: string | undefined;
};

const DEFAULT_TAGS: WaTag[] = [
  { id: "tag-1", name: "Orçamento enviado", color: "#16845b" },
  { id: "tag-2", name: "Troca de óleo", color: "#eab308" },
  { id: "tag-3", name: "Pneus novos", color: "#3b82f6" },
  { id: "tag-4", name: "Agendado", color: "#22c55e" },
  { id: "tag-5", name: "Pós-venda", color: "#a855f7" },
  { id: "tag-6", name: "Importante", color: "#ef4444" },
];

const DEFAULT_REPLIES: WaQuickReply[] = [
  { id: "r-1", shortcut: "endereco", text: "📍 Olá! Nossas unidades atendem de segunda a sábado:\n• Asa Sul: CRS 508 Bloco B Loja 40\n• Taguatinga: QNG 32 Lote 1\nQual unidade fica mais fácil para você?" },
  { id: "r-2", shortcut: "oleo", text: "🛢️ Nosso serviço de troca de óleo inclui óleo sintético de alta performance, filtro novo e inspeção preventiva gratuita de 15 itens do seu veículo!" },
  { id: "r-3", shortcut: "pneus", text: "🛞 Trabalhamos com pneus originais das melhores marcas (Pirelli, Michelin, Goodyear) com montagem, balanceamento e garantia oficial inclusos!" },
  { id: "r-4", shortcut: "horario", text: "⏱️ Nosso horário de atendimento é de segunda a sexta das 08h às 18h e sábado das 08h às 14h." },
  { id: "r-5", shortcut: "pix", text: "💳 Aceitamos PIX, cartões de crédito e débito parcelado em até 10x sem juros na loja." }
];

const DEFAULT_AUTOMATION: WaAutomation = {
  greeting: {
    enabled: true,
    text: "Olá! Seja bem-vindo à Ômega Supertroca. Em instantes um de nossos atendentes especializados irá lhe responder!"
  },
  away: {
    enabled: true,
    text: "Olá! No momento estamos fora do nosso horário de atendimento (Seg a Sex das 08h às 18h / Sáb das 08h às 14h). Já registramos sua mensagem e retornaremos assim que a loja abrir!",
    start: "08:00",
    end: "18:00",
    days: [1, 2, 3, 4, 5]
  }
};

const EMOJI_CATEGORIAS = {
  "Mais usados": ["😂", "❤️", "👍", "🙏", "😊", "🔥", "👏", "🚗", "🔧", "📦", "📍", "💰", "⏱️", "✅", "🤝", "🎉"],
  "Ômega & Carros": ["🚗", "🚙", "🚘", "🛞", "⛽", "🔧", "🔨", "⚙️", "🛢️", "🛠️", "🏁", "⏱️", "📞", "🔑", "🏷️", "💳"],
  "Carinhas": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😎", "🤩", "🤔", "🙌", "🥳"],
  "Gestos": ["👍", "👎", "👌", "✌️", "🤞", "🤝", "👏", "🙌", "🤲", "👊", "✊", "🤛", "🤜", "🖐️", "✋", "👋", "🤙", "💪", "🙏", "✍️"],
};

const REACOES_RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const hhmm = () => whatsappHour(Date.now());

function WhatsAppAvatar({ name, photo, size }: { name: string; photo?: string | null | undefined; size?: number }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  return (
    <div className="wa-avatar" style={size ? { width: size, height: size, flexBasis: size } : undefined}>
      {photo && photo !== failedPhoto ? (
        <img src={photo} alt={name} onError={() => setFailedPhoto(photo)} referrerPolicy="no-referrer" />
      ) : iniciais(name)}
    </div>
  );
}

function lastMessageAt(chat: Conversa) {
  return chat.msgs.reduce((latest, message) =>
    message.kind === "nota" || message.kind === "sistema"
      ? latest : Math.max(latest, whatsappMessageTime(message.sentAt)),
    whatsappMessageTime(chat.lastMessageAt));
}

const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Inbox(props: { initialId?: string }) {
  const { activeAccount } = useActiveAccount();
  return <AccountInboxConnection key={activeAccount.id} account={activeAccount} {...props} />;
}

function AccountInboxConnection({ account, initialId }: { account: Subconta; initialId?: string }) {
  const { status, error, refresh, checking } = useWhatsAppConnection(account.id);
  if (status?.state !== 'open') {
    const label = error ? 'Não foi possível acessar o WhatsApp' : status ? whatsappStatusLabel[status.state] : 'Verificando conexão do WhatsApp';
    return <section className="card wa-connection-empty" aria-live="polite">
      <MessageCircle size={26} aria-hidden="true" />
      <h2 className="t-h3">{label}</h2>
      <p>{account.nome}</p>
      {error ? <p role="alert">{whatsappErrorMessage(error)}</p> : status && <p className="t-caption">{status.state === 'unavailable' ? 'Verifique se o servidor da Evolution está disponível e tente novamente.' : 'Abra Canais para conectar o número desta conta.'}</p>}
      <div className="om-toolbar">
        <Link to="/canais" className="btn btn-primary btn-sm">Abrir Canais</Link>
        <button type="button" className="btn btn-outline btn-sm" disabled={checking} onClick={() => void refresh()}>Verificar conexão</button>
      </div>
    </section>;
  }
  return <ConnectedInbox key={status.instance} activeAccount={account} evoStatus={status} carregarStatus={refresh} {...(initialId ? { initialId } : {})} />;
}

function ConnectedInbox({ initialId, activeAccount, evoStatus, carregarStatus }: {
  initialId?: string;
  activeAccount: Subconta;
  evoStatus: EvolutionStatusResponse;
  carregarStatus: () => Promise<unknown>;
}) {
  const isSubconta = activeAccount.id !== 'matriz';
  const { user } = useRouteContext({ from: '/_authenticated' });
  const [lista, setLista] = useDeals(activeAccount.id, evoStatus.instance);
  const instanceName = evoStatus.instance;
  const activeRef = useRef(true);
  const syncingChatsRef = useRef(false);
  const syncingMessagesRef = useRef(new Set<string>());
  const reactingRef = useRef(new Set<string>());
  const [syncError, setSyncError] = useState('');

  // Estados de busca e filtros
  const [busca, setBusca] = useState("");
  const [filtroChip, setFiltroChip] = useState<"all" | "unread" | "groups">("all");
  const [filtroCaixa, setFiltroCaixa] = useState<"inbox" | "archive">("inbox");
  const [filtroTag, setFiltroTag] = useState<string>("");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("");
  const [selId, setSelId] = useState(initialId ?? "");

  // Conversa ativa selecionada
  const sel = useMemo(() => lista.find((c) => c.id === selId) ?? lista.find((c) => c.aliases?.includes(selId)) ?? null, [lista, selId]);

  const atualizarConversa = useCallback(
    (id: string, updater: (c: Conversa) => Conversa) => {
      setLista((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    [setLista]
  );

  // Rascunho e envio
  const [draft, setDraft] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagemRespondendo, setMensagemRespondendo] = useState<Mensagem | null>(null);

  // Anexos
  const [imagemPrevia, setImagemPrevia] = useState<{ url: string; base64: string; file: File } | null>(null);
  const [docPrevia, setDocPrevia] = useState<{ url: string; base64: string; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [imagemLightbox, setImagemLightbox] = useState<string | null>(null);

  // Gravação de Áudio Real
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerGravacaoRef = useRef<any>(null);

  // Busca interna na conversa ativa
  const [buscaInlineAberta, setBuscaInlineAberta] = useState(false);
  const [buscaInlineQuery, setBuscaInlineQuery] = useState("");

  // Emojis
  const [emojiPickerAberto, setEmojiPickerAberto] = useState(false);
  const [catEmojiAtiva, setCatEmojiAtiva] = useState<keyof typeof EMOJI_CATEGORIAS>("Mais usados");

  // Menus Flutuantes
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversa: Conversa;
  } | null>(null);
  const [reacaoMenuMsgId, setReacaoMenuMsgId] = useState<string | null>(null);

  // Modais
  type ModalType = "none" | "settings" | "jobs" | "favorites" | "history" | "newChat" | "contactDetails" | "connection";
  const [modalAberto, setModalAberto] = useState<ModalType>("none");
  const [abaConfig, setAbaConfig] = useState<"preferences" | "tags" | "replies" | "automation">("preferences");
  const [abaGaleria, setAbaGaleria] = useState<"all" | "image" | "audio" | "video" | "document" | "links">("all");

  // Business Data armazenado no localStorage
  const [prefs, setPrefs] = useState<WaPreferences>(() => {
    if (typeof window === "undefined") return { sound: true, volume: 0.4, popup: true, preview: true, theme: "dark", font: "normal" };
    try {
      const s = localStorage.getItem("wa-business-preferences");
      return s ? { sound: true, volume: 0.4, popup: true, preview: true, theme: "dark", font: "normal", ...JSON.parse(s) } : { sound: true, volume: 0.4, popup: true, preview: true, theme: "dark", font: "normal" };
    } catch {
      return { sound: true, volume: 0.4, popup: true, preview: true, theme: "dark", font: "normal" };
    }
  });

  const [tags, setTags] = useState<WaTag[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TAGS;
    try {
      const s = localStorage.getItem("wa-business-tags");
      return s ? JSON.parse(s) : DEFAULT_TAGS;
    } catch {
      return DEFAULT_TAGS;
    }
  });

  const [replies, setReplies] = useState<WaQuickReply[]>(() => {
    if (typeof window === "undefined") return DEFAULT_REPLIES;
    try {
      const s = localStorage.getItem("wa-business-replies");
      return s ? JSON.parse(s) : DEFAULT_REPLIES;
    } catch {
      return DEFAULT_REPLIES;
    }
  });

  const [jobs, setJobs] = useState<WaJob[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const s = localStorage.getItem(`wa-business-jobs:${user!.id}:${activeAccount.id}`);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [automation, setAutomation] = useState<WaAutomation>(() => {
    if (typeof window === "undefined") return DEFAULT_AUTOMATION;
    try {
      const s = localStorage.getItem("wa-business-automation");
      return s ? JSON.parse(s) : DEFAULT_AUTOMATION;
    } catch {
      return DEFAULT_AUTOMATION;
    }
  });

  // Notificações flutuantes tipo toast
  const [popups, setPopups] = useState<WaPopupNotice[]>([]);

  const dispararPopup = useCallback((title: string, text: string, jid?: string) => {
    if (!prefs.popup) return;
    const novo: WaPopupNotice = { id: crypto.randomUUID(), title, text, jid };
    setPopups((prev) => [novo, ...prev].slice(0, 4));
    if (prefs.sound) playWebAudioBeep(prefs.volume);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== novo.id));
    }, 8000);
  }, [prefs]);

  // Salvar no localStorage quando alterado
  useEffect(() => {
    localStorage.setItem("wa-business-preferences", JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    localStorage.setItem("wa-business-tags", JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem("wa-business-replies", JSON.stringify(replies));
  }, [replies]);

  useEffect(() => {
    localStorage.setItem(`wa-business-jobs:${user!.id}:${activeAccount.id}`, JSON.stringify(jobs));
  }, [jobs, user, activeAccount.id]);

  useEffect(() => {
    localStorage.setItem("wa-business-automation", JSON.stringify(automation));
  }, [automation]);

  // Server functions da Evolution API e IA Chatbot
  const fetchEvoChats = useServerFn(getEvolutionChats);
  const fetchEvoMessages = useServerFn(getEvolutionMessages);
  const sendEvoMsg = useServerFn(sendEvolutionMessage);
  const sendEvoMedia = useServerFn(sendEvolutionMedia);
  const sendEvoAudio = useServerFn(sendEvolutionAudio);
  const sendEvoReaction = useServerFn(sendEvolutionReaction);
  const markEvoRead = useServerFn(markEvolutionChatAsRead);
  const callGenerateAi = useServerFn(generateAiChatbotResponse);
  const fetchAiKeyStatus = useServerFn(getAiKeyStatus);
  const fetchSaveAiApiKey = useServerFn(saveAiApiKey);

  const [modalAiKeyAberto, setModalAiKeyAberto] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [salvandoKey, setSalvandoKey] = useState(false);
  const [customAiKey, setCustomAiKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("omega_ai_custom_key") || "";
  });
  const [serverAiKeyConfigured, setServerAiKeyConfigured] = useState(false);

  useEffect(() => {
    fetchAiKeyStatus()
      .then((res) => {
        if (res?.configured) setServerAiKeyConfigured(true);
      })
      .catch(() => null);
  }, [fetchAiKeyStatus]);

  const temChaveIa = Boolean(customAiKey || serverAiKeyConfigured);

  // Autonomous delivery requires a durable, tenant-scoped workflow (not browser flags).
  const iaGlobalAtiva = false;

  // Sugestões de resposta rápida e status de geração da IA
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const [gerandoIa, setGerandoIa] = useState(false);


  const [syncingEvo, setSyncingEvo] = useState(false);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);

  const msgsEndRef = useRef<HTMLDivElement | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);

  // Painel lateral de Bastidores da IA Hudson
  const [painelBastidoresAberto, setPainelBastidoresAberto] = useState(true);

  // Controle de mensagens processadas para resposta automática
  const isReplyingAiRef = useRef<Set<string>>(new Set());
  const processedAiMessagesRef = useRef<Set<string>>(new Set());
  const [iaChatsAtivos, setIaChatsAtivos] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("omega_ia_active_chats");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Modo de composição: mensagem para o WhatsApp ou nota interna privada (RN-044)
  const [modoComposicao, setModoComposicao] = useState<"mensagem" | "nota">("mensagem");

  // Modal para registro de motivo de perda (RN-066)
  const [modalPerdaAberto, setModalPerdaAberto] = useState(false);
  const [motivoPerdaSelecionado, setMotivoPerdaSelecionado] = useState<string>(MOTIVOS_PERDA[0]);
  const [detalhesPerda, setDetalhesPerda] = useState("");

  // Rastreia scroll do chat para não forçar rolagem se o atendente tiver subido para ler mensagens antigas
  const handleMessagesScroll = useCallback(() => {
    if (!messagesAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((smooth = true, force = false) => {
    if (!messagesAreaRef.current) return;
    if (force || isNearBottomRef.current) {
      if (smooth) {
        messagesAreaRef.current.scrollTo({
          top: messagesAreaRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
      }
    }
  }, []);

  // Ao trocar de conversa selecionada, rola diretamente para o final
  useEffect(() => {
    if (selId) {
      isNearBottomRef.current = true;
      scrollToBottom(false, true);
      const t1 = setTimeout(() => scrollToBottom(false, true), 50);
      const t2 = setTimeout(() => scrollToBottom(false, true), 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    return undefined;
  }, [selId, scrollToBottom]);

  // Se estiver próximo ao rodapé e o número de mensagens mudar, rola suave para o final
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [sel?.msgs?.length, scrollToBottom]);

  // Auto-expansão do composer conforme o atendente digita mais linhas (até ~6 linhas com scrollbar acima disso)
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const scrollHeight = textareaRef.current.scrollHeight;
    const maxHeight = 138;
    textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textareaRef.current.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  // Executa a resposta inteligente da IA para o WhatsApp
  const responderComIa = useCallback(
    async (
      remoteJid: string,
      chatNome: string,
      chatTel: string,
      historicoMsgs: Array<{ fromMe: boolean; text: string; id: string }>,
      carro?: string,
      etapa?: string
    ) => {
      if (isReplyingAiRef.current.has(remoteJid)) return;
      isReplyingAiRef.current.add(remoteJid);
      setGerandoIa(true);

      try {
        const apiMessages = historicoMsgs
          .slice(-15)
          .map((m) => ({
            role: m.fromMe ? ("assistant" as const) : ("user" as const),
            content: m.text || "",
          }))
          .filter((m) => m.content.trim().length > 0);

        if (apiMessages.length === 0) return;

        const res = await callGenerateAi({
          data: {
            messages: apiMessages,
            contactName: chatNome,
            contactPhone: chatTel,
            carro: carro || "",
            etapa: etapa || "Abordagem",
            apiKey: customAiKey || undefined,
          },
        });

        if (res && res.replyText) {
          const { cleanContent, suggestions, bastidores } = parseAiOutput(res.rawReply || res.replyText);
          const textoParaEnviar = cleanContent || res.replyText;

          // Envia resposta via Evolution API para o WhatsApp (APENAS o texto limpo, NUNCA os bastidores!)
          await sendEvoMsg({
            data: {
              number: remoteJid,
              text: textoParaEnviar,
              accountId: activeAccount.id,
              expectedInstance: instanceName,
            },
          }).catch((err) => console.warn("Aviso ao enviar via Evolution API:", err));

          const novaMsg: Mensagem = {
            id: crypto.randomUUID(),
            kind: "vendedor",
            text: textoParaEnviar,
            t: hhmm(),
            nome: "Hudson (IA)",
          };

          setLista((prev) =>
            prev.map((c) => {
              if (c.id !== remoteJid && !c.aliases?.includes(remoteJid)) return c;

              let novaEtapa = c.etapa;
              if (bastidores?.etapa) {
                const e = bastidores.etapa.toLowerCase();
                if (e.includes("pesquisa") || e.includes("descoberta") || e.startsWith("p")) novaEtapa = "Descoberta da necessidade";
                else if (e.includes("orçamento") || e.includes("proposta") || e.startsWith("o")) novaEtapa = "Proposta";
                else if (e.includes("negociação") || e.startsWith("n")) novaEtapa = "Negociação";
                else if (e.includes("agend") || e.startsWith("t") || e.startsWith("e")) novaEtapa = "Agendamento";
                else if (e.includes("abordagem") || e.startsWith("a")) novaEtapa = "Abordagem";
              }

              const novasTags = new Set(c.tags || []);
              if (bastidores?.etiqueta) novasTags.add(bastidores.etiqueta);

              return {
                ...c,
                msgs: [...c.msgs, novaMsg],
                etapa: novaEtapa,
                tags: Array.from(novasTags),
                bastidores: bastidores || c.bastidores,
                esperaMin: null,
                data: "Hoje",
                log: [{ t: hhmm(), text: `Hudson respondeu automaticamente (${res.model})` }, ...c.log],
              };
            })
          );

          if (suggestions && suggestions.length > 0) {
            setChatSuggestions(suggestions);
          }

          dispararPopup("IA Hudson", `Hudson respondeu automaticamente para ${chatNome}`, remoteJid);
          if (prefs.sound) playWebAudioBeep(prefs.volume);
          setTimeout(() => scrollToBottom(true, true), 100);
        }
      } catch (err) {
        console.error("Erro ao gerar resposta automática da IA:", err);
      } finally {
        isReplyingAiRef.current.delete(remoteJid);
        setGerandoIa(false);
      }
    },
    [callGenerateAi, sendEvoMsg, activeAccount.id, instanceName, setLista, dispararPopup, prefs.sound, prefs.volume, scrollToBottom]
  );

  // Alterna o status da IA para uma conversa específica
  const alternarIaConversa = useCallback(
    (targetId?: string) => {
      const remoteJid = targetId || sel?.id;
      if (!remoteJid) return;

      const chatAlvo = lista.find((c) => c.id === remoteJid || c.aliases?.includes(remoteJid));
      const vaiAtivar = !chatAlvo?.iaAtiva;

      if (vaiAtivar && !temChaveIa) {
        setAiKeyInput(customAiKey);
        setModalAiKeyAberto(true);
        dispararPopup(
          "Configurar IA Hudson",
          "Insira sua chave do Google Gemini para ativar o Hudson.",
          remoteJid
        );
        return;
      }

      setLista((prev) => {
        const chat = prev.find((c) => c.id === remoteJid || c.aliases?.includes(remoteJid));
        const novoEstado = !chat?.iaAtiva;

        setIaChatsAtivos((old) => {
          const set = new Set(old);
          if (novoEstado) set.add(remoteJid);
          else set.delete(remoteJid);
          const arr = Array.from(set);
          try {
            localStorage.setItem("omega_ia_active_chats", JSON.stringify(arr));
          } catch {}
          return arr;
        });

        dispararPopup(
          "IA Hudson",
          novoEstado
            ? `🤖 IA ativada para ${chat?.nome || remoteJid}`
            : `🤖 IA desativada para ${chat?.nome || remoteJid}`,
          remoteJid
        );

        if (novoEstado && chat && chat.msgs.length > 0) {
          const ult = chat.msgs[chat.msgs.length - 1];
          if (ult && ult.kind === "cliente" && !processedAiMessagesRef.current.has(ult.id)) {
            processedAiMessagesRef.current.add(ult.id);
            setTimeout(() => {
              void responderComIa(
                remoteJid,
                chat.nome || "Cliente",
                chat.tel || "",
                chat.msgs.map((m) => ({ fromMe: m.kind === "vendedor", text: m.text, id: m.id })),
                chat.carro,
                chat.etapa
              );
            }, 300);
          }
        }

        return prev.map((c) =>
          c.id === remoteJid || c.aliases?.includes(remoteJid) ? { ...c, iaAtiva: novoEstado } : c
        );
      });
    },
    [sel?.id, lista, temChaveIa, customAiKey, setLista, dispararPopup, responderComIa]
  );

  // Sugerir resposta com IA manualmente para o atendente
  const sugerirRespostaIa = useCallback(async () => {
    if (!sel || gerandoIa) return;
    if (!temChaveIa) {
      setAiKeyInput(customAiKey);
      setModalAiKeyAberto(true);
      dispararPopup("Configurar IA Hudson", "Insira sua chave do Google Gemini para usar sugestões.");
      return;
    }
    setGerandoIa(true);
    try {
      const apiMessages = sel.msgs
        .slice(-15)
        .map((m) => ({
          role: m.kind === "cliente" ? ("user" as const) : ("assistant" as const),
          content: m.text || "",
        }))
        .filter((m) => m.content.trim().length > 0);

      const res = await callGenerateAi({
        data: {
          messages: apiMessages.length > 0 ? apiMessages : [{ role: "user", content: "Olá" }],
          contactName: sel.nome,
          contactPhone: sel.tel,
          carro: sel.carro,
          etapa: sel.etapa,
          apiKey: customAiKey || undefined,
        },
      });

      if (res && res.replyText) {
        const { cleanContent, suggestions, bastidores } = parseAiOutput(res.rawReply || res.replyText);
        setDraft(cleanContent || res.replyText);
        if (suggestions && suggestions.length > 0) {
          setChatSuggestions(suggestions);
        }
        if (bastidores) atualizarConversa(sel.id, c => ({ ...c, bastidores }));
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      dispararPopup("Sugestão indisponível", err instanceof Error ? err.message : "Tente novamente depois.");
    } finally {
      setGerandoIa(false);
    }
  }, [sel, gerandoIa, temChaveIa, customAiKey, callGenerateAi, atualizarConversa, dispararPopup]);

  const salvarChaveIa = useCallback(async (chave: string) => {
    const limpa = chave.trim();
    if (!limpa) return;
    setSalvandoKey(true);
    try {
      await fetchSaveAiApiKey({ data: { apiKey: limpa } });
      try {
        localStorage.setItem("omega_ai_custom_key", limpa);
      } catch {}
      setCustomAiKey(limpa);
      setServerAiKeyConfigured(true);
      setModalAiKeyAberto(false);
      dispararPopup("IA Hudson", "Chave de IA configurada com sucesso! Você já pode ativar o Hudson.");
      if (sel) {
        setTimeout(() => alternarIaConversa(sel.id), 250);
      }
    } catch (err) {
      dispararPopup("Erro ao salvar chave", err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setSalvandoKey(false);
    }
  }, [fetchSaveAiApiKey, dispararPopup, sel, alternarIaConversa]);

  // Sincroniza conversas da Evolution API para a instância da conta ativa
  const sincronizarChats = useCallback(async (selecionarPrimeiro = false, silencioso = false) => {
    if (!activeRef.current || syncingChatsRef.current) return;
    syncingChatsRef.current = true;
    if (!silencioso) setSyncingEvo(true);
    try {
      const chats = await fetchEvoChats({ data: { accountId: activeAccount.id, expectedInstance: instanceName } });
      if (!activeRef.current) return;
      setSyncError("");
      {
        const evoConversas: Conversa[] = chats.map((c) => ({
          id: c.remoteJid,
          aliases: c.aliases,
          nome: c.name || c.phone,
          tel: c.phone,
          avatar: c.avatar,
          origem: c.isGroup ? "Grupo WhatsApp" : "WhatsApp Direto",
          carro: "",
          canal: isSubconta ? `WhatsApp ${activeAccount.loja}` : "WhatsApp",
          loja: isSubconta ? activeAccount.loja : "",
          etapa: "Abordagem",
          status: "Em atendimento humano",
          valor: 0,
          perda: null,
          agente: isSubconta ? activeAccount.resp : "Atendente",
          data: whatsappDate(c.timestamp),
          lastMessageAt: c.timestamp,
          esperaMin: c.unreadCount > 0 && c.timestamp > 0
            ? Math.max(0, Math.floor((Date.now() - c.timestamp) / 60000)) : null,
          arquivada: false,
          naoLida: c.unreadCount,
          tags: c.isGroup ? ["grupo"] : ["whatsapp"],
          msgs: c.lastMessage
            ? [{ id: `preview:${c.remoteJid}`, kind: "cliente", text: c.lastMessage, t: whatsappHour(c.timestamp), sentAt: c.timestamp }]
            : [],
          ficha: [],
          ag: null,
          log: [{ t: hhmm(), text: `sincronizado com Evolution (${instanceName})` }],
          iaAtiva: iaChatsAtivos.includes(c.remoteJid) || Boolean(c.aliases?.some((a: string) => iaChatsAtivos.includes(a))),
        }));

        setLista((prev) => {
          const filtrados = prev.filter(
            (p) => p.id.includes("@") && !["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"].includes(p.id)
          );
          const map = new Map(filtrados.flatMap(chat => [chat.id, ...(chat.aliases ?? [])].map(id => [id, chat] as const)));

          const merged = evoConversas.map((novo, index) => {
            const rawChat = chats[index];
            let existente = map.get(novo.id);
            if (!existente && rawChat?.aliases) {
              for (const alias of rawChat.aliases) {
                if (map.has(alias)) {
                  existente = map.get(alias);
                  break;
                }
              }
            }

            if (existente) {
              const nomeFinal = (novo.nome !== "Contato" && novo.nome !== "Grupo WhatsApp" && whatsappName(novo.nome))
                || existente.nome || novo.nome;
              const existingHistory = existente.msgs.filter(message => !message.id.startsWith("preview:"));

              return {
                ...novo,
                nome: nomeFinal,
                tel: novo.tel || whatsappPhone(existente.id) || existente.aliases?.map(whatsappPhone).find(Boolean) || "",
                aliases: Array.from(new Set([novo.id, existente.id, ...(novo.aliases ?? []), ...(existente.aliases ?? [])])),
                id: whatsappPhone(novo.id) ? novo.id : whatsappPhone(existente.id) ? existente.id : novo.id,
                avatar: novo.avatar || existente.avatar,
                etapa: existente.etapa,
                status: existente.status,
                arquivada: existente.arquivada,
                perda: existente.perda,
                resultado: existente.resultado,
                ficha: existente.ficha,
                ag: existente.ag,
                log: existente.log,
                carro: existente.carro || novo.carro,
                loja: existente.loja || novo.loja,
                valor: existente.valor || novo.valor,
                fixada: existente.fixada,
                silenciada: existente.silenciada,
                tags: existente.tags?.length ? existente.tags : novo.tags,
                notas: existente.notas,
                lembrete: existente.lembrete,
                msgs: existingHistory.length ? existingHistory : novo.msgs,
                iaAtiva: Boolean(existente.iaAtiva || iaChatsAtivos.includes(existente.id) || iaChatsAtivos.includes(novo.id) || existente.aliases?.some(a => iaChatsAtivos.includes(a))),
              };
            }
            return novo;
          });
          const known = new Set(chats.flatMap(chat => [chat.remoteJid, ...(chat.aliases ?? [])]));
          return [...merged, ...prev.filter(chat => !known.has(chat.id) && chat.log.some(event => event.text === "Conversa criada manualmente"))];
        });

        // Atualiza seleção caso selId seja vazio ou aponte para um ID unificado/alias
        setSelId((cur) => {
          if (!cur && selecionarPrimeiro) return evoConversas[0]?.id || "";
          if (evoConversas.some((x) => x.id === cur)) return cur;
          const canonicalChat = chats.find((c) => c.aliases?.includes(cur));
          if (canonicalChat) return canonicalChat.remoteJid;
          return selecionarPrimeiro ? (evoConversas[0]?.id || cur) : cur;
        });
      }
    } catch (err) {
      if (activeRef.current) {
        setSyncError(err instanceof Error ? err.message : "Falha ao atualizar as conversas.");
        void carregarStatus();
      }
    } finally {
      syncingChatsRef.current = false;
      if (activeRef.current) setSyncingEvo(false);
    }
  }, [fetchEvoChats, setLista, activeAccount.id, instanceName, activeAccount.loja, activeAccount.resp, isSubconta, carregarStatus]);

  // Carrega histórico de mensagens
  const carregarMensagens = useCallback(async (remoteJid: string, silencioso = false, aliases: string[] = []) => {
    if (!activeRef.current || !remoteJid.includes("@") || syncingMessagesRef.current.has(remoteJid)) return;
    syncingMessagesRef.current.add(remoteJid);
    if (!silencioso) setCarregandoMsgs(true);

    try {
      const history = await fetchEvoMessages({ data: { remoteJid, aliases: aliases.slice(0, 4), accountId: activeAccount.id, expectedInstance: instanceName } });
      if (!activeRef.current) return;
      setLista(prev => {
        const chat = prev.find(c => c.id === remoteJid || c.aliases?.includes(remoteJid));
        if (!chat) return prev;
        const incoming: Mensagem[] = history.messages.map(message => ({
          id: message.id, kind: message.fromMe ? 'vendedor' : 'cliente',
          text: message.text, t: message.timestamp, sentAt: message.sentAt,
          nome: message.fromMe ? 'Você' : chat.id.endsWith('@g.us') ? message.sender : chat.nome,
          senderAvatar: message.senderAvatar,
          remoteJid: message.remoteJid, participant: message.participant,
          mediaType: message.mediaType, mediaUrl: message.mediaUrl, caption: message.caption,
          fileName: message.fileName, quotedText: message.quotedText,
        }));
        const msgs = mergeWhatsAppHistory(chat.msgs, incoming, history.reactions);
        const tel = history.phone || chat.tel;
        const nextAliases = Array.from(new Set([...(chat.aliases ?? []), ...history.aliases]));
        const aliasesChanged = nextAliases.length !== (chat.aliases?.length ?? 0);
        if (msgs === chat.msgs && tel === chat.tel && !aliasesChanged) return prev;
        if (silencioso && msgs.length > chat.msgs.length && prefs.sound) playWebAudioBeep(prefs.volume);

        // Se a IA desta conversa estiver ATIVA (no chat ou nos ativos salvos)
        const ultimo = msgs[msgs.length - 1];
        const iaAtiva = Boolean(chat.iaAtiva || iaChatsAtivos.includes(remoteJid) || iaChatsAtivos.includes(chat.id));
        if (iaAtiva && ultimo && ultimo.kind === 'cliente' && !processedAiMessagesRef.current.has(ultimo.id)) {
          processedAiMessagesRef.current.add(ultimo.id);
          setTimeout(() => {
            void responderComIa(
              remoteJid,
              chat.nome || "Cliente",
              chat.tel || "",
              msgs.map((m) => ({ fromMe: m.kind === "vendedor", text: m.text, id: m.id })),
              chat.carro,
              chat.etapa
            );
          }, 300);
        }

        return prev.map(c => c === chat ? { ...c, msgs, tel, aliases: aliasesChanged ? nextAliases : c.aliases } : c);
      });
    } catch (err) {
      if (activeRef.current) {
        if (!silencioso) dispararPopup("Mensagens indisponíveis", err instanceof Error ? err.message : "Tente novamente.");
        void carregarStatus();
      }
    } finally {
      syncingMessagesRef.current.delete(remoteJid);
      if (activeRef.current && !silencioso) {
        setCarregandoMsgs(false);
        setTimeout(() => scrollToBottom(false, true), 40);
      }
    }
  }, [fetchEvoMessages, setLista, prefs.sound, prefs.volume, activeAccount.id, instanceName, scrollToBottom, carregarStatus, dispararPopup, iaChatsAtivos, responderComIa]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
        recorder.stream.getTracks().forEach(track => track.stop());
      }
      if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current);
    };
  }, []);

  const selecionarConversa = useCallback((id: string) => setSelId(id), []);
  const selectedId = sel?.id;
  const selectedAliases = sel?.aliases?.join(",") ?? "";

  useEffect(() => {
    void sincronizarChats(true);
    const timer = setInterval(() => void sincronizarChats(false, true), WHATSAPP_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [sincronizarChats]);

  useEffect(() => {
    if (!selectedId) return;
    setLista(prev => prev.map(c => c.id === selectedId && c.naoLida > 0 ? { ...c, naoLida: 0 } : c));
    void markEvoRead({ data: { remoteJid: selectedId, accountId: activeAccount.id, expectedInstance: instanceName } }).catch(() => null);
  }, [selectedId, setLista, markEvoRead, activeAccount.id, instanceName]);

  useEffect(() => {
    if (!selectedId) return;
    const aliases = selectedAliases ? selectedAliases.split(",") : [];
    void carregarMensagens(selectedId, false, aliases);
    const timer = setInterval(() => void carregarMensagens(selectedId, true, aliases), WHATSAPP_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [selectedId, selectedAliases, carregarMensagens]);

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setReacaoMenuMsgId(null);
      setEmojiPickerAberto(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);


  // Filtragem avançada das conversas com deduplicação defensiva
  const conversasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");

    const filtradas = lista.filter((c) => {
      // Filtro de Arquivadas
      const ehArquivada = Boolean(c.arquivada);
      if (filtroCaixa === "archive" && !ehArquivada) return false;
      if (filtroCaixa === "inbox" && ehArquivada) return false;

      // Filtro de Chips (todas / nao lidas / grupos)
      if (filtroChip === "unread" && !(c.naoLida > 0)) return false;
      if (filtroChip === "groups" && !(c.tags?.includes("grupo") || c.id.endsWith("@g.us"))) return false;

      // Filtro de Etiqueta
      if (filtroTag && !c.tags?.includes(filtroTag)) return false;

      // Filtro de Etapa
      if (filtroEtapa && c.etapa !== filtroEtapa) return false;

      // Busca por texto/telefone/nome
      if (q) {
        if (c.nome.toLowerCase().includes(q)) return true;
        if (digitos.length >= 3 && c.tel.replace(/\D/g, "").includes(digitos)) return true;
        if (c.msgs.some((m) => m.text.toLowerCase().includes(q))) return true;
        return false;
      }

      return true;
    });

    // Unifica e deduplica contatos duplicados (ex: Gabriel Nunes em @lid e @s.whatsapp.net)
    const seenMap = new Map<string, Conversa>();
    for (const c of filtradas) {
      const isGroup = c.tags?.includes("grupo") || c.id.endsWith("@g.us");
      if (isGroup) {
        seenMap.set(`group:${c.id}`, c);
        continue;
      }

      const rawTel = c.tel?.replace(/\D/g, "");
      const key = rawTel && rawTel.length >= 10
        ? `phone:${rawTel}`
        : `id:${c.id}`;

      if (seenMap.has(key)) {
        const existing = seenMap.get(key)!;
        // Prefere o contato com JID canônico @s.whatsapp.net
        const prefereNovo = c.id.endsWith("@s.whatsapp.net") && !existing.id.endsWith("@s.whatsapp.net");
        const principal = prefereNovo ? c : existing;
        const secundario = prefereNovo ? existing : c;

        seenMap.set(key, {
          ...principal,
          nome: principal.nome && !/^\d+$/.test(principal.nome) ? principal.nome : secundario.nome,
          tel: principal.tel || secundario.tel,
          avatar: principal.avatar || secundario.avatar,
          naoLida: Math.max(principal.naoLida || 0, secundario.naoLida || 0),
          msgs: principal.msgs.length >= secundario.msgs.length ? principal.msgs : secundario.msgs,
          fixada: principal.fixada || secundario.fixada,
          silenciada: principal.silenciada || secundario.silenciada,
        });
      } else {
        seenMap.set(key, c);
      }
    }

    return Array.from(seenMap.values()).sort((a, b) => {
      // Fixadas primeiro
      if (a.fixada && !b.fixada) return -1;
      if (!a.fixada && b.fixada) return 1;
      return lastMessageAt(b) - lastMessageAt(a);
    });
  }, [lista, busca, filtroChip, filtroCaixa, filtroTag, filtroEtapa]);

  // Sugestões de Respostas Rápidas ao digitar "/"
  const sugestoesRapidas = useMemo(() => {
    if (!draft.startsWith("/")) return [];
    const query = draft.slice(1).toLowerCase();
    return replies.filter((r) => r.shortcut.toLowerCase().startsWith(query));
  }, [draft, replies]);

  // Mensagens filtradas na busca interna inline da conversa
  const msgsFiltradasInline = useMemo(() => {
    if (!sel || !buscaInlineQuery.trim()) return [];
    const q = buscaInlineQuery.toLowerCase();
    return sel.msgs.filter((m) => m.text.toLowerCase().includes(q));
  }, [sel, buscaInlineQuery]);

  // Todas as mensagens favoritadas
  const todasFavoritas = useMemo(() => {
    const res: { chat: Conversa; msg: Mensagem }[] = [];
    lista.forEach((c) => {
      c.msgs.forEach((m) => {
        if (m.starred) res.push({ chat: c, msg: m });
      });
    });
    return res;
  }, [lista]);

  // Ações de Envio
  const confirmarEnvio = (conversationId: string, localId: string, result: { key?: { id?: string; remoteJid?: string; participant?: string } } | null) => {
    atualizarConversa(conversationId, conversation => {
      const id = result?.key?.id;
      const duplicate = conversation.msgs.some(message => message.id === id);
      if (!id || duplicate) return { ...conversation, msgs: conversation.msgs.filter(message => message.id !== localId) };
      const msgs = conversation.msgs.map(message => message.id === localId ? {
        ...message, id, remoteJid: result?.key?.remoteJid || conversationId, participant: result?.key?.participant,
      } : message);
      return { ...conversation, msgs };
    });
  };

  const enviarTexto = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (enviando || !sel) return;
    const t = draft.trim();
    if (!t) return;

    // Regra RN-044: Nota interna da equipe é salva apenas localmente no histórico e NUNCA é enviada ao cliente no WhatsApp
    if (modoComposicao === "nota") {
      setDraft("");
      const novaNota: Mensagem = {
        id: crypto.randomUUID(),
        kind: "nota",
        text: t,
        t: hhmm(),
        nome: "Você (Nota Interna)",
      };
      atualizarConversa(sel.id, (c) => ({
        ...c,
        msgs: [...c.msgs, novaNota],
        log: [{ t: hhmm(), text: `Nota interna adicionada: "${t.slice(0, 35)}..."` }, ...c.log],
      }));
      if (prefs.sound) playWebAudioBeep(prefs.volume);
      setTimeout(() => scrollToBottom(true), 40);
      setModoComposicao("mensagem");
      return;
    }

    setEnviando(true);
    setDraft("");
    const quote = mensagemRespondendo;
    setMensagemRespondendo(null);

    const novaMsg: Mensagem = {
      id: `pending:${crypto.randomUUID()}`,
      sentAt: Date.now(),
      kind: "vendedor",
      text: t,
      t: hhmm(),
      nome: "Você",
      quotedText: quote?.text,
      quotedSender: quote?.nome || (quote?.kind === "vendedor" ? "Você" : sel.nome),
    };

    atualizarConversa(sel.id, (c) => ({
      ...c,
      esperaMin: null,
      data: "Hoje",
      status: "Em atendimento humano",
      msgs: [...c.msgs, novaMsg],
    }));

    if (prefs.sound) playWebAudioBeep(prefs.volume);
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const result = await sendEvoMsg({
        data: {
          number: sel.id,
          text: t,
          quotedId: quote?.id,
          accountId: activeAccount.id, expectedInstance: instanceName,
        },
      });
      confirmarEnvio(sel.id, novaMsg.id, result);
      atualizarConversa(sel.id, (c) => ({
        ...c,
        log: [{ t: hhmm(), text: "Mensagem enviada com sucesso" }, ...c.log],
      }));
    } catch (err: any) {
      atualizarConversa(sel.id, c => ({ ...c, msgs: c.msgs.filter(m => m.id !== novaMsg.id) }));
      setDraft(t);
      setMensagemRespondendo(quote);
      console.error("Erro ao enviar pelo WhatsApp:", err);
      alert(`Erro ao enviar pelo WhatsApp: ${err.message || err}`);
    } finally {
      setEnviando(false);
    }
  };

  // Enviar Áudio Gravado
  const iniciarGravacaoAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setGravandoAudio(true);
      setTempoGravacao(0);

      timerGravacaoRef.current = setInterval(() => {
        setTempoGravacao((t) => t + 1);
      }, 1000);
    } catch (err) {
      alert("Permissão para microfone necessária para gravação de áudio.");
    }
  };

  const pararEEnviarGravacaoAudio = async () => {
    if (!mediaRecorderRef.current || !sel) return;

    clearInterval(timerGravacaoRef.current);
    setGravandoAudio(false);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const novaMsg: Mensagem = {
          id: `pending:${crypto.randomUUID()}`,
      sentAt: Date.now(),
          kind: "vendedor",
          nome: "Você",
          text: "🎙️ Áudio",
          t: hhmm(),
          mediaType: "audio",
          mediaUrl: base64Audio,
        };

        atualizarConversa(sel.id, (c) => ({
          ...c,
          msgs: [...c.msgs, novaMsg],
          data: "Hoje",
        }));

        if (prefs.sound) playWebAudioBeep(prefs.volume);
        setTimeout(() => scrollToBottom(true), 40);

        try {
          const result = await sendEvoAudio({
            data: {
              number: sel.id,
              audio: base64Audio,
              accountId: activeAccount.id, expectedInstance: instanceName,
            },
          });
          confirmarEnvio(sel.id, novaMsg.id, result);
        } catch (err: any) {
          confirmarEnvio(sel.id, novaMsg.id, null);
          alert(`Erro ao enviar áudio: ${err.message || err}`);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
  };

  const cancelarGravacaoAudio = () => {
    if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current);
    setGravandoAudio(false);
    setTempoGravacao(0);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
    }
    audioChunksRef.current = [];
  };

  // Enviar Imagem com Legenda
  const enviarImagemAnexada = async () => {
    if (!imagemPrevia || !sel) return;

    const { base64, file } = imagemPrevia;
    const legenda = draft.trim();
    setImagemPrevia(null);
    setDraft("");

    const novaMsg: Mensagem = {
      id: `pending:${crypto.randomUUID()}`,
      sentAt: Date.now(),
      kind: "vendedor",
      nome: "Você",
      text: legenda ? `📷 ${legenda}` : "📷 Imagem",
      t: hhmm(),
      mediaType: "image",
      mediaUrl: base64,
      caption: legenda,
    };

    atualizarConversa(sel.id, (c) => ({
      ...c,
      msgs: [...c.msgs, novaMsg],
      data: "Hoje",
    }));

    if (prefs.sound) playWebAudioBeep(prefs.volume);
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const result = await sendEvoMedia({
        data: {
          number: sel.id,
          mediatype: "image",
          mimetype: file.type || "image/jpeg",
          media: base64,
          caption: legenda,
          fileName: file.name,
          accountId: activeAccount.id, expectedInstance: instanceName,
        },
      });
      confirmarEnvio(sel.id, novaMsg.id, result);
    } catch (err: any) {
      confirmarEnvio(sel.id, novaMsg.id, null);
      alert(`Erro ao enviar imagem: ${err.message || err}`);
    }
  };

  // Enviar Documento
  const enviarDocumentoAnexado = async () => {
    if (!docPrevia || !sel) return;

    const { base64, file } = docPrevia;
    setDocPrevia(null);

    const novaMsg: Mensagem = {
      id: `pending:${crypto.randomUUID()}`,
      sentAt: Date.now(),
      kind: "vendedor",
      nome: "Você",
      text: `📄 ${file.name}`,
      t: hhmm(),
      mediaType: "document",
      fileName: file.name,
      mediaUrl: base64,
    };

    atualizarConversa(sel.id, (c) => ({
      ...c,
      msgs: [...c.msgs, novaMsg],
      data: "Hoje",
    }));

    if (prefs.sound) playWebAudioBeep(prefs.volume);
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const result = await sendEvoMedia({
        data: {
          number: sel.id,
          mediatype: "document",
          mimetype: file.type || "application/pdf",
          media: base64,
          fileName: file.name,
          accountId: activeAccount.id, expectedInstance: instanceName,
        },
      });
      confirmarEnvio(sel.id, novaMsg.id, result);
    } catch (err: any) {
      confirmarEnvio(sel.id, novaMsg.id, null);
      alert(`Erro ao enviar documento: ${err.message || err}`);
    }
  };

  // Reagir a Mensagem
  const aplicarReacao = async (msg: Mensagem, emoji: string) => {
    if (!sel || !msg.remoteJid) return;
    const conversationId = sel.id;
    const operation = `${conversationId}:${msg.id}`;
    if (reactingRef.current.has(operation)) return;
    reactingRef.current.add(operation);
    setReacaoMenuMsgId(null);
    const value = msg.reactions?.find(reaction => reaction.actor === 'self')?.emoji === emoji ? '' : emoji;
    const at = Date.now();
    try {
      await sendEvoReaction({
        data: {
          remoteJid: msg.remoteJid, messageId: msg.id, fromMe: msg.kind === 'vendedor',
          reaction: value, participant: msg.participant,
          accountId: activeAccount.id, expectedInstance: instanceName,
        },
      });
      atualizarConversa(conversationId, c => ({ ...c, msgs: mergeWhatsAppHistory(c.msgs, [], [{
        messageId: msg.id, actor: 'self', emoji: value, at, eventId: `local:${crypto.randomUUID()}`,
      }]) }));
    } catch (error) {
      if (activeRef.current) dispararPopup('Não foi possível reagir', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      reactingRef.current.delete(operation);
    }
  };

  // Alternar Favorito
  const alternarFavorito = (msgId: string) => {
    if (!sel) return;
    atualizarConversa(sel.id, (c) => ({
      ...c,
      msgs: c.msgs.map((m) => (m.id === msgId ? { ...m, starred: !m.starred } : m)),
    }));
  };

  // Novo Agendamento
  const [novoAgendamentoTexto, setNovoAgendamentoTexto] = useState("");
  const [novoAgendamentoData, setNovoAgendamentoData] = useState("");
  const [novoAgendamentoTipo, setNovoAgendamentoTipo] = useState<"message" | "reminder">("message");

  const criarAgendamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel || !novoAgendamentoTexto.trim() || !novoAgendamentoData) return;

    const dataMs = new Date(novoAgendamentoData).getTime();
    const novoJob: WaJob = {
      id: crypto.randomUUID(),
      jid: sel.id,
      contatoNome: sel.nome,
      kind: novoAgendamentoTipo,
      text: novoAgendamentoTexto.trim(),
      at: dataMs,
      status: "queued",
      createdAt: Date.now(),
    };

    setJobs((prev) => [novoJob, ...prev]);
    setNovoAgendamentoTexto("");
    setNovoAgendamentoData("");
    dispararPopup("Agendamento criado", `${novoAgendamentoTipo === "message" ? "Mensagem agendada" : "Lembrete salvo"} para ${sel.nome}`);
  };

  // Nova Etiqueta
  const [novaTagNome, setNovaTagNome] = useState("");
  const [novaTagCor, setNovaTagCor] = useState("#16845b");

  const criarEtiqueta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTagNome.trim()) return;
    const tag: WaTag = {
      id: `tag-${crypto.randomUUID().slice(0, 6)}`,
      name: novaTagNome.trim(),
      color: novaTagCor,
    };
    setTags((prev) => [...prev, tag]);
    setNovaTagNome("");
  };

  // Nova Resposta Rápida
  const [novoAtalho, setNovoAtalho] = useState("");
  const [novoTextoResposta, setNovoTextoResposta] = useState("");

  const criarRespostaRapida = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAtalho.trim() || !novoTextoResposta.trim()) return;
    const r: WaQuickReply = {
      id: crypto.randomUUID(),
      shortcut: novoAtalho.trim().replace(/^\//, ""),
      text: novoTextoResposta.trim(),
    };
    setReplies((prev) => [...prev, r]);
    setNovoAtalho("");
    setNovoTextoResposta("");
  };

  // Iniciar Conversa com Novo Número
  const [novoNumero, setNovoNumero] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const iniciarNovaConversa = (e: React.FormEvent) => {
    e.preventDefault();
    const digitos = novoNumero.replace(/\D/g, "");
    if (digitos.length < 10) {
      alert("Digite um número com DDD válido (Ex: 61 99999-9999)");
      return;
    }
    const jid = `${digitos.startsWith("55") ? digitos : `55${digitos}`}@s.whatsapp.net`;
    const formatado = novoNome.trim() || `(${digitos.slice(-11, -9)}) ${digitos.slice(-9, -4)}-${digitos.slice(-4)}`;

    const existente = lista.find((c) => c.id === jid);
    if (existente) {
      setSelId(existente.id);
      setModalAberto("none");
      return;
    }

    const nova: Conversa = {
      id: jid,
      nome: formatado,
      tel: formatado,
      origem: "WhatsApp Direto",
      carro: "",
      canal: isSubconta ? `WhatsApp ${activeAccount.loja}` : "WhatsApp",
      loja: isSubconta ? activeAccount.loja : "",
      etapa: "Abordagem",
      status: "Em atendimento humano",
      valor: 0,
      perda: null,
      agente: isSubconta ? activeAccount.resp : "Atendente",
      data: "Hoje",
      esperaMin: null,
      arquivada: false,
      naoLida: 0,
      tags: ["whatsapp"],
      msgs: [],
      ficha: [],
      ag: null,
      log: [{ t: hhmm(), text: "Conversa criada manualmente" }],
    };

    setLista((prev) => [nova, ...prev]);
    selecionarConversa(nova.id);
    setModalAberto("none");
    setNovoNumero("");
    setNovoNome("");
  };

  return (
    <div className="wa-root-wrap">
      {/* CABEÇALHO SUPERIOR RESUMIDO */}
      <div className="ibx-head" style={{ marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="t-eyebrow boot-eyebrow" style={{ color: "var(--fg-3)" }}>
            Painel WhatsApp · Atendimento
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 12,
              backgroundColor: isSubconta ? "rgba(168, 85, 247, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: isSubconta ? "#c084fc" : "#22c55e",
              border: `1px solid ${isSubconta ? "rgba(168, 85, 247, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: isSubconta ? "#a855f7" : "#22c55e",
              }}
            />
            {activeAccount.nome} · Instância: {instanceName}
          </span>
        </div>

        <div className="ibx-head-acts" style={{ gap: 8 }}>
          {/* BOTÃO MASTER: LIGAR / DESLIGAR IA GLOBALMENTE */}
          <button
            type="button"
            disabled
            className="btn btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11.5,
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 20,
              cursor: "pointer",
              transition: "all 0.2s ease",
              backgroundColor: iaGlobalAtiva ? "rgba(34, 197, 94, 0.18)" : "rgba(255, 255, 255, 0.05)",
              color: iaGlobalAtiva ? "#22c55e" : "var(--fg-3)",
              border: `1px solid ${iaGlobalAtiva ? "rgba(34, 197, 94, 0.45)" : "var(--border-subtle)"}`,
              boxShadow: iaGlobalAtiva ? "0 0 12px rgba(34, 197, 94, 0.25)" : "none",
            }}
            title="Automação pendente de regras no servidor. Sugestões com revisão humana estão disponíveis."
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: iaGlobalAtiva ? "#22c55e" : "#71717a",
                boxShadow: iaGlobalAtiva ? "0 0 8px #22c55e" : "none",
              }}
            />
            <Bot size={14} />
            <span>IA: revisão humana</span>
          </button>

          {evoStatus && (
            <button
              type="button"
              onClick={() => setModalAberto("connection")}
              className="btn btn-outline btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
              title={`Instância: ${evoStatus.instance} · Status: ${evoStatus.state}`}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: evoStatus.state === "open" ? "#22c55e" : "#ef4444",
                }}
              />
              {evoStatus.state === "open" ? `Online (${evoStatus.chatsCount} chats)` : evoStatus.state}
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void sincronizarChats(false)}
            disabled={syncingEvo}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} className={syncingEvo ? "animate-spin" : ""} />
            {syncingEvo ? "Sincronizando…" : "Sincronizar"}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setModalAberto("newChat")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <MessageSquarePlus size={14} /> Nova conversa
          </button>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL DO PAINEL WHATSAPP (ESTILO GPT) */}
      <div className="wa-container" data-font={prefs.font}>
        {/* 1. RAIL VERTICAL ESQUERDO (FERRAMENTAS GERAIS) */}
        <nav className="wa-rail" aria-label="Ferramentas do WhatsApp">
          <div className="wa-brand" title="WhatsApp Atendimento">
            <MessageCircle size={22} />
          </div>

          <button
            type="button"
            className="wa-rail-btn active"
            title="Conversas"
            aria-label="Conversas"
          >
            <MessageCircle size={20} />
          </button>

          <button
            type="button"
            className="wa-rail-btn"
            title="Configurações e Preferências"
            onClick={() => {
              setAbaConfig("preferences");
              setModalAberto("settings");
            }}
          >
            <Settings size={20} />
          </button>

          <button
            type="button"
            className="wa-rail-btn"
            title="Agendamentos e Lembretes"
            onClick={() => setModalAberto("jobs")}
          >
            <Clock size={20} />
            {jobs.filter((j) => j.status === "queued").length > 0 && (
              <span className="wa-tool-badge">
                {jobs.filter((j) => j.status === "queued").length}
              </span>
            )}
          </button>

          <button
            type="button"
            className="wa-rail-btn"
            title="Mensagens Favoritas"
            onClick={() => setModalAberto("favorites")}
          >
            <Star size={20} />
            {todasFavoritas.length > 0 && (
              <span className="wa-tool-badge" style={{ backgroundColor: "#eab308" }}>
                {todasFavoritas.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className="wa-rail-btn"
            title="Buscar no Histórico"
            onClick={() => setModalAberto("history")}
          >
            <Search size={20} />
          </button>

          <div className="wa-rail-bottom">
            <button
              type="button"
              className="wa-rail-btn wa-status-btn"
              title={`Status da Conexão (${instanceName})`}
              onClick={() => setModalAberto("connection")}
            >
              <LinkIcon size={19} />
              <span className={`wa-status-dot ${evoStatus?.state === "open" ? "online" : ""}`} />
            </button>
            <div className="wa-local-avatar" title="Atendente Operando">
              EU
            </div>
          </div>
        </nav>

        {/* 2. SIDEBAR COM LISTA DE CONVERSAS E FILTROS */}
        <aside className="wa-sidebar">
          <header className="wa-side-header">
            <div>
              <span className="wa-eyebrow">SEU ESPAÇO DE ATENDIMENTO</span>
              <h1>Conversas</h1>
            </div>
            <button
              type="button"
              className="wa-btn-icon"
              title="Nova conversa"
              onClick={() => setModalAberto("newChat")}
            >
              <Plus size={20} />
            </button>
          </header>

          {/* Campo de Busca Unificada */}
          <div className="wa-search-wrap">
            <Search size={16} />
            <input
              type="search"
              placeholder="Pesquisar contatos e mensagens"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filtros em Chips */}
          <div className="wa-chips">
            <button
              type="button"
              className={`wa-chip ${filtroChip === "all" ? "selected" : ""}`}
              onClick={() => setFiltroChip("all")}
            >
              Todas
            </button>
            <button
              type="button"
              className={`wa-chip ${filtroChip === "unread" ? "selected" : ""}`}
              onClick={() => setFiltroChip("unread")}
            >
              Não lidas
            </button>
            <button
              type="button"
              className={`wa-chip ${filtroChip === "groups" ? "selected" : ""}`}
              onClick={() => setFiltroChip("groups")}
            >
              Grupos
            </button>
          </div>

          {/* Filtros Avançados de Negócio */}
          <div className="wa-business-filters">
            <select
              value={filtroCaixa}
              onChange={(e) => setFiltroCaixa(e.target.value as any)}
              aria-label="Caixa de conversas"
            >
              <option value="inbox">Caixa de entrada</option>
              <option value="archive">Arquivadas</option>
            </select>

            <select
              value={filtroTag}
              onChange={(e) => setFiltroTag(e.target.value)}
              aria-label="Filtrar por etiqueta"
            >
              <option value="">Todas as etiquetas</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name.toLowerCase()}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filtroEtapa}
              onChange={(e) => setFiltroEtapa(e.target.value)}
              className="full-span"
              aria-label="Filtrar por etapa"
            >
              <option value="">Todas as etapas do funil</option>
              {ETAPAS.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Linha de Sincronização */}
          <div className="wa-sync-line">
            <span>{syncingEvo ? "Atualizando conversas…" : "Atualização ao vivo · Evolution"}</span>
            <button
              type="button"
              className="wa-btn-icon"
              style={{ width: 26, height: 26 }}
              title="Atualizar lista"
              onClick={() => void sincronizarChats(false)}
            >
              <RefreshCw size={13} className={syncingEvo ? "animate-spin" : ""} />
            </button>
          </div>

          {syncError && <p className="om-notice" role="alert">{syncError}</p>}

          {/* Lista de Conversas com Context Menu */}
          <div className="wa-chat-list">
            {conversasFiltradas.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--fg-3)", fontSize: 13 }}>
                Nenhuma conversa encontrada para os filtros selecionados.
              </div>
            ) : (
              conversasFiltradas.map((c) => {
                const isSelected = selId === c.id;
                const ult = ultimaMsg(c);
                const tagEncontrada = tags.find((t) => c.tags?.includes(t.name.toLowerCase()));

                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`wa-chat-row ${isSelected ? "selected" : ""}`}
                    onClick={() => selecionarConversa(c.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, conversa: c });
                    }}
                  >
                    <WhatsAppAvatar name={c.nome} photo={c.avatar} />
                    <div className="wa-chat-copy">
                      <div className="wa-row-top">
                        <span className="wa-row-name">{c.nome}</span>
                        <time className="wa-row-time">{whatsappListTime(lastMessageAt(c))}</time>
                      </div>

                      <div className="wa-row-bottom">
                        <span className="wa-preview">
                          {ult ? (
                            ult.mediaType === "image" ? "📷 Imagem" :
                            ult.mediaType === "audio" ? "🎙️ Áudio" :
                            ult.mediaType === "document" ? "📄 Documento" :
                            ult.text
                          ) : (
                            "Iniciar uma conversa"
                          )}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {c.fixada && <span title="Fixada">📌</span>}
                          {c.silenciada && <span title="Silenciada">♩</span>}
                          {c.naoLida > 0 && <span className="wa-unread-badge">{c.naoLida}</span>}
                        </div>
                      </div>

                      {/* Linha de Etiquetas, IA e Etapa */}
                      <div className="wa-row-tags">
                        {c.iaAtiva && (
                          <span
                            className="wa-tag"
                            style={{
                              backgroundColor: iaGlobalAtiva ? "rgba(34, 197, 94, 0.16)" : "rgba(234, 179, 8, 0.16)",
                              color: iaGlobalAtiva ? "#22c55e" : "#eab308",
                              border: `1px solid ${iaGlobalAtiva ? "rgba(34, 197, 94, 0.35)" : "rgba(234, 179, 8, 0.35)"}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 10,
                            }}
                            title={iaGlobalAtiva ? "IA Ativa nesta conversa" : "IA ativada nesta conversa (Global desligada)"}
                          >
                            🤖 IA
                          </span>
                        )}
                        {tagEncontrada && (
                          <span
                            className="wa-tag"
                            style={{ ["--tag-color" as any]: tagEncontrada.color }}
                          >
                            {tagEncontrada.name}
                          </span>
                        )}
                        {c.etapa && <span className="wa-stage">{c.etapa}</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* 3. ÁREA DA CONVERSA / TELA DE BOAS-VINDAS */}
        <main className="wa-conversation">
          {!sel ? (
            /* TELA DE BOAS-VINDAS (ESTILO GPT EXATO) */
            <section className="wa-welcome">
              <div className="wa-welcome-art">
                <div className="wa-art-disc">
                  <MessageCircle size={60} strokeWidth={1.5} />
                </div>
                <span className="wa-art-bubble one">Olá! 👋</span>
                <span className="wa-art-bubble two">Tudo em um lugar.</span>
                <span className="wa-art-spark">✦</span>
              </div>
              <span className="wa-eyebrow">CONECTADO AO SEU DIA A DIA</span>
              <h2>Suas conversas,<br />com mais espaço.</h2>
              <p>
                Escolha um contato ao lado para continuar o atendimento<br />
                ou comece uma nova mensagem.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalAberto("newChat")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={16} /> Nova conversa
              </button>
              <div style={{ marginTop: 40, fontSize: 11, color: "var(--fg-3)", display: "flex", alignItems: "center", gap: 6 }}>
                <LinkIcon size={13} />
                Conexão local Evolution API · Instância {instanceName}
              </div>
            </section>
          ) : (
            /* CONVERSA ATIVA */
            <>
              {/* CABEÇALHO DO CHAT */}
              <header className="wa-chat-header">
                <WhatsAppAvatar name={sel.nome} photo={sel.avatar} size={40} />

                <button
                  type="button"
                  className="wa-header-identity"
                  onClick={() => setModalAberto("contactDetails")}
                >
                  <strong>{sel.nome}</strong>
                  <span>
                    {sel.id.endsWith("@g.us") ? "Grupo" : sel.tel || "Número indisponível"} · {sel.etapa} {sel.arquivada ? "· Arquivada" : ""}
                  </span>
                </button>

                {/* BOTÃO LIGAR/DESLIGAR IA NESTA CONVERSA */}
                <button
                  type="button"
                  onClick={() => alternarIaConversa(sel.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "4px 11px",
                    borderRadius: 16,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backgroundColor: sel.iaAtiva
                      ? "rgba(34, 197, 94, 0.16)"
                      : "rgba(255, 255, 255, 0.05)",
                    color: sel.iaAtiva ? "#22c55e" : "var(--fg-3)",
                    border: `1px solid ${
                      sel.iaAtiva
                        ? "rgba(34, 197, 94, 0.35)"
                        : "var(--border-subtle)"
                    }`,
                  }}
                  title={
                    sel.iaAtiva
                      ? "IA Hudson ATIVA: respondendo automaticamente este cliente pelo WhatsApp. (Clique para desligar)"
                      : "IA DESLIGADA: clique para ativar o atendimento automático do Hudson neste chat"
                  }
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: sel.iaAtiva ? "#22c55e" : "#71717a",
                    }}
                  />
                  <Bot size={13} />
                  <span>IA: {sel.iaAtiva ? "Ativa" : "Desligada"}</span>
                </button>

                <div className="wa-header-actions">
                  <button
                    type="button"
                    className="wa-btn-icon"
                    title="Arquivos e links da conversa"
                    onClick={() => {
                      setAbaGaleria("all");
                      setModalAberto("history");
                    }}
                  >
                    <Folder size={18} />
                  </button>

                  <button
                    type="button"
                    className="wa-btn-icon"
                    title="Buscar nesta conversa"
                    onClick={() => setBuscaInlineAberta((prev) => !prev)}
                  >
                    <Search size={18} />
                  </button>

                  {/* BOTAO BASTIDORES DA IA HUDSON */}
                  <button
                    type="button"
                    className={`wa-btn-icon ${painelBastidoresAberto ? "active" : ""}`}
                    title={painelBastidoresAberto ? "Ocultar Bastidores da IA" : "Ver Bastidores da IA (Hudson)"}
                    onClick={() => setPainelBastidoresAberto((prev) => !prev)}
                    style={{
                      position: "relative",
                      color: sel.bastidores?.atencao ? "#eab308" : sel.iaAtiva ? "#22c55e" : "inherit",
                    }}
                  >
                    <BrainCircuit size={18} />
                    {sel.bastidores?.atencao && (
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "#ef4444",
                        }}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    className="wa-btn-icon"
                    title="Ações da conversa"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({ x: rect.left - 100, y: rect.bottom + 6, conversa: sel });
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>

                  <button
                    type="button"
                    className="wa-btn-icon"
                    title="Dados e ficha de atendimento"
                    onClick={() => setModalAberto("contactDetails")}
                  >
                    <Info size={18} />
                  </button>
                </div>
              </header>

              <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
                {/* Coluna Principal do Chat */}
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>

                  {/* BUSCA INLINE NA CONVERSA */}
                  {buscaInlineAberta && (
                <div className="wa-conversation-search">
                  <div className="wa-conversation-search-input">
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Pesquisar nesta conversa"
                      value={buscaInlineQuery}
                      onChange={(e) => setBuscaInlineQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="wa-btn-icon"
                      style={{ width: 28, height: 28 }}
                      onClick={() => {
                        setBuscaInlineAberta(false);
                        setBuscaInlineQuery("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {buscaInlineQuery && (
                    <div className="wa-conversation-search-results">
                      <div style={{ padding: "6px 16px", fontSize: 11, color: "var(--fg-3)" }}>
                        {msgsFiltradasInline.length} mensagem(ns) encontrada(s)
                      </div>
                      {msgsFiltradasInline.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            padding: "8px 16px",
                            borderTop: "1px solid var(--line, #e2e8e4)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            const el = document.getElementById(`msg-${m.id}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <strong>{m.kind === "vendedor" ? "Você" : sel.nome}</strong>
                            <span style={{ fontSize: 10, color: "var(--fg-3)" }}>{m.t}</span>
                          </div>
                          <span style={{ color: "var(--fg-2)" }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* HISTÓRICO DE MENSAGENS */}
              <div className="wa-messages-area" ref={messagesAreaRef} onScroll={handleMessagesScroll}>
                {sel.msgs.length === 0 ? (
                  <div style={{ textAlign: "center", margin: "auto", padding: 24, color: "var(--fg-3)", fontSize: 13 }}>
                    Nenhuma mensagem sincronizada nesta conversa ainda.<br />
                    Envie uma mensagem abaixo para iniciar o atendimento.
                  </div>
                ) : (
                  sel.msgs.map((m, index) => {
                    const day = whatsappDayKey(m.sentAt);
                    const startsDay = index === 0 || day !== whatsappDayKey(sel.msgs[index - 1]?.sentAt);
                    const divider = startsDay && <div className="wa-day-divider">{whatsappDayLabel(m.sentAt)}</div>;
                    if (m.kind === "nota") {
                      return (
                        <React.Fragment key={m.id}>
                        {divider}
                        <div
                          id={`msg-${m.id}`}
                          className="wa-msg-row internal-note"
                          style={{ display: "flex", justifyContent: "center", margin: "10px 0", width: "100%" }}
                        >
                          <div
                            style={{
                              maxWidth: "85%",
                              background: "rgba(245, 158, 11, 0.12)",
                              border: "1px dashed rgba(245, 158, 11, 0.5)",
                              borderRadius: 10,
                              padding: "10px 14px",
                              color: "var(--fg-1)",
                              fontSize: 12.5,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 11, color: "#d97706", textTransform: "uppercase" }}>
                                <Lock size={12} /> Nota Interna da Equipe (RN-044)
                              </span>
                              <span style={{ fontSize: 10.5, color: "var(--fg-3)" }}>{m.t}</span>
                            </div>
                            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.text}</div>
                          </div>
                        </div>
                        </React.Fragment>
                      );
                    }

                    const isMe = m.kind === "vendedor";
                    const isStarred = Boolean(m.starred);

                    return (
                      <React.Fragment key={m.id}>
                      {divider}
                      <div
                        id={`msg-${m.id}`}
                        className={`wa-msg-row ${isMe ? "me" : ""} ${m.reactions?.some(reaction => reaction.emoji) ? "has-reactions" : ""}`}
                      >
                        <div className="wa-bubble">
                          {!isMe && sel.id.endsWith("@g.us") && m.nome && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                              <WhatsAppAvatar name={m.nome} photo={m.senderAvatar} size={20} />
                              <strong>{m.nome}</strong>
                            </div>
                          )}
                          {/* Mensagem Citada */}
                          {m.quotedText && (
                            <div className="wa-quoted-message">
                              <strong>Em resposta a {m.quotedSender || "mensagem"}</strong>
                              <span>{m.quotedText}</span>
                            </div>
                          )}

                          {/* Mídia Imagem */}
                          {m.mediaType === "image" && (
                            <div style={{ marginBottom: 6 }}>
                              {m.mediaUrl ? (
                                <img
                                  src={m.mediaUrl}
                                  alt={m.caption || "Imagem"}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: 320,
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                  onClick={() => setImagemLightbox(m.mediaUrl!)}
                                />
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-3)", fontSize: 13 }}>
                                  <ImageIcon size={18} /> <span>Imagem</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mídia Áudio */}
                          {m.mediaType === "audio" && (
                            <div style={{ marginBottom: 6 }}>
                              {m.mediaUrl ? (
                                <audio controls src={m.mediaUrl} style={{ maxWidth: 280 }} />
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-3)", fontSize: 13 }}>
                                  <Mic size={18} /> <span>Áudio</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mídia Documento */}
                          {m.mediaType === "document" && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(0,0,0,0.04)",
                                padding: 8,
                                borderRadius: 6,
                                marginBottom: 6,
                              }}
                            >
                              <FileText size={24} color="#16845b" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {m.fileName || "Documento"}
                                </strong>
                              </div>
                              {m.mediaUrl && (
                                <a
                                  href={m.mediaUrl}
                                  download={m.fileName || "arquivo"}
                                  className="wa-btn-icon"
                                  style={{ width: 28, height: 28 }}
                                  title="Baixar arquivo"
                                >
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Texto do Balão (Limpa bastidores e tags de IA defensivamente) */}
                          {(() => {
                            const rawText = m.caption || m.text;
                            if (!rawText) return null;
                            if (!m.caption && m.mediaType && (m.text === "📷 [Imagem]" || m.text === "🎙️ [Áudio]" || m.text === "🎥 [Vídeo]" || m.text.startsWith("📄 [Documento"))) {
                              return null;
                            }
                            const { cleanContent } = parseAiOutput(rawText);
                            return <div className="wa-bubble-text">{cleanContent || rawText}</div>;
                          })()}

                          {m.reactions?.some(reaction => reaction.emoji) && (
                            <span className="wa-reaction-badge" aria-label="Reações à mensagem">
                              {m.reactions.filter(reaction => reaction.emoji).map(reaction => (
                                <span key={reaction.actor} title={reaction.actor === 'self' ? 'Você' : 'Contato'}>{reaction.emoji}</span>
                              ))}
                            </span>
                          )}

                          {/* Metadados (Hora e Ticks) */}
                          <div className="wa-bubble-meta">
                            {isStarred && <Star size={11} fill="#eab308" color="#eab308" />}
                            <time>{whatsappHour(m.sentAt)}</time>
                            {isMe && <span className="wa-checks read">✓✓</span>}
                          </div>

                          {/* Ferramentas flutuantes no balão ao passar o mouse */}
                          <div className="wa-msg-tools">
                            <button
                              type="button"
                              title="Responder"
                              onClick={() => {
                                setMensagemRespondendo(m);
                                if (textareaRef.current) textareaRef.current.focus();
                              }}
                            >
                              ↩
                            </button>
                            <button
                              type="button"
                              title="Reagir"
                              disabled={!m.remoteJid}
                              onClick={(e) => {
                                e.stopPropagation();
                                setReacaoMenuMsgId(m.id);
                              }}
                            >
                              ☺
                            </button>
                            <button
                              type="button"
                              title={isStarred ? "Desfavoritar" : "Favoritar"}
                              onClick={() => alternarFavorito(m.id)}
                            >
                              {isStarred ? "★" : "☆"}
                            </button>
                          </div>

                          {/* Menu de Reação Rápida */}
                          {reacaoMenuMsgId === m.id && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "100%",
                                right: 0,
                                background: "var(--panel, #ffffff)",
                                border: "1px solid var(--line, #e2e8e4)",
                                borderRadius: 20,
                                padding: "4px 8px",
                                display: "flex",
                                gap: 6,
                                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                                zIndex: 10,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {REACOES_RAPIDAS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    fontSize: 16,
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                  }}
                                  onClick={() => aplicarReacao(m, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })
                )}
                {gerandoIa && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 16,
                      backgroundColor: "var(--panel, #ffffff)",
                      border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                      color: "var(--fg-2)",
                      fontSize: 12,
                      fontWeight: 600,
                      margin: "6px 0",
                      alignSelf: "flex-start",
                    }}
                  >
                    <Bot size={15} color="#22c55e" className="animate-spin" />
                    <span>Hudson está digitando…</span>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>

              {/* BARRA DE PRÉVIA DE CITAÇÃO */}
              {mensagemRespondendo && (
                <div className="wa-quote-preview">
                  <div>
                    <strong>Respondendo a {mensagemRespondendo.nome || "mensagem"}</strong>
                    <span style={{ color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {mensagemRespondendo.text || (mensagemRespondendo.mediaType ? `[${mensagemRespondendo.mediaType}]` : "Mensagem")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wa-btn-icon"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setMensagemRespondendo(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* BARRA DE PRÉVIA DE ANEXO DE IMAGEM */}
              {imagemPrevia && (
                <div className="wa-attachment-preview">
                  <img src={imagemPrevia.url} alt="Prévia do anexo" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12, display: "block" }}>{imagemPrevia.file.name}</strong>
                    <span style={{ fontSize: 11, color: "var(--fg-3)" }}>A mensagem abaixo será enviada como legenda.</span>
                  </div>
                  <button
                    type="button"
                    className="wa-btn-icon"
                    onClick={() => setImagemPrevia(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* BARRA DE PRÉVIA DE ANEXO DE DOCUMENTO */}
              {docPrevia && (
                <div className="wa-attachment-preview">
                  <FileText size={32} color="#16845b" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12, display: "block" }}>{docPrevia.file.name}</strong>
                    <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Documento pronto para envio.</span>
                  </div>
                  <button
                    type="button"
                    className="wa-btn-icon"
                    onClick={() => setDocPrevia(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* SUGESTÕES RÁPIDAS AO DIGITAR "/" */}
              {sugestoesRapidas.length > 0 && (
                <div className="wa-quick-suggestions">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-3)", padding: "4px 8px" }}>
                    Respostas Rápidas (digite ou clique para inserir):
                  </div>
                  {sugestoesRapidas.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setDraft(r.text);
                        if (textareaRef.current) textareaRef.current.focus();
                      }}
                    >
                      <strong>/{r.shortcut}</strong> {r.text}
                    </button>
                  ))}
                </div>
              )}

              {/* ÁREA DO COMPOSER COM FERRAMENTAS SUPERIORES */}
              <div className="wa-composer-area">
                {/* Ferramentas Rápidas Superiores */}
                <div className="wa-compose-tools">
                  {/* Seletor de Modo: Mensagem para o cliente vs Nota Interna (RN-044) */}
                  <div style={{ display: "inline-flex", borderRadius: 14, background: "rgba(0,0,0,0.06)", padding: 2, marginRight: 6 }}>
                    <button
                      type="button"
                      onClick={() => setModoComposicao("mensagem")}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11.5,
                        borderRadius: 12,
                        border: "none",
                        background: modoComposicao === "mensagem" ? "var(--panel, #ffffff)" : "transparent",
                        color: modoComposicao === "mensagem" ? "var(--fg-1)" : "var(--fg-3)",
                        fontWeight: modoComposicao === "mensagem" ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <MessageSquare size={12} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoComposicao("nota")}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11.5,
                        borderRadius: 12,
                        border: "none",
                        background: modoComposicao === "nota" ? "#fef3c7" : "transparent",
                        color: modoComposicao === "nota" ? "#b45309" : "var(--fg-3)",
                        fontWeight: modoComposicao === "nota" ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="Nota Interna (RN-044): Visível apenas para a equipe, não é enviada ao cliente"
                    >
                      <Lock size={12} /> Nota Interna
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void sugerirRespostaIa()}
                    disabled={gerandoIa}
                    title="Pede ao Hudson para sugerir uma resposta inteligente para esta conversa"
                    style={{
                      color: "#22c55e",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Sparkles size={13} className={gerandoIa ? "animate-spin" : ""} />
                    {gerandoIa ? "Gerando IA…" : "Sugerir com IA"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAbaConfig("replies");
                      setModalAberto("settings");
                    }}
                  >
                    <Zap size={13} color="#eab308" /> Respostas rápidas
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovoAgendamentoTipo("message");
                      setModalAberto("jobs");
                    }}
                  >
                    <Clock size={13} /> Agendar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovoAgendamentoTipo("reminder");
                      setModalAberto("jobs");
                    }}
                  >
                    <Bell size={13} /> Lembrete
                  </button>
                </div>

                {/* Sugestões inteligentes da IA */}
                {chatSuggestions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "rgba(34, 197, 94, 0.06)",
                      borderTop: "1px solid rgba(34, 197, 94, 0.15)",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Bot size={12} /> Sugestões Hudson:
                    </span>
                    {chatSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setDraft(sug);
                          if (textareaRef.current) textareaRef.current.focus();
                        }}
                        style={{
                          fontSize: 11.5,
                          padding: "3px 9px",
                          borderRadius: 12,
                          backgroundColor: "rgba(34, 197, 94, 0.12)",
                          color: "#22c55e",
                          border: "1px solid rgba(34, 197, 94, 0.28)",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                        title="Clique para inserir esta resposta no campo"
                      >
                        {sug}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setChatSuggestions([])}
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        color: "var(--fg-3)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Fechar sugestões"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Aviso visual de Nota Interna (RN-044) */}
                {modoComposicao === "nota" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 14px",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#b45309",
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderTop: "1px solid rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <Lock size={13} />
                    <span>
                      <strong>NOTA INTERNA PRIVADA (RN-044):</strong> Esta mensagem fica registrada no CRM apenas para a equipe e <u>nunca</u> será enviada ao cliente no WhatsApp.
                    </span>
                  </div>
                )}

                {/* Formulário Principal */}
                <form
                  className="wa-composer"
                  style={modoComposicao === "nota" ? { backgroundColor: "rgba(245, 158, 11, 0.07)" } : undefined}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (gravandoAudio) {
                      void pararEEnviarGravacaoAudio();
                      return;
                    }
                    if (imagemPrevia) {
                      void enviarImagemAnexada();
                    } else if (docPrevia) {
                      void enviarDocumentoAnexado();
                    } else {
                      void enviarTexto();
                    }
                  }}
                >
                  {gravandoAudio ? (
                    <div className="wa-recording-active-bar">
                      <button
                        type="button"
                        className="wa-trash-btn"
                        title="Cancelar gravação"
                        onClick={cancelarGravacaoAudio}
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="wa-recording-pulse-wrap">
                        <span className="wa-recording-dot" />
                        <span className="wa-recording-timer">{formatTimer(tempoGravacao)}</span>
                      </div>
                      <button
                        type="button"
                        className="wa-send-btn wa-send-audio-btn"
                        title="Parar e enviar áudio"
                        onClick={pararEEnviarGravacaoAudio}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Botão Emoji */}
                      <button
                        type="button"
                        className="wa-btn-icon"
                        title="Inserir Emoji"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmojiPickerAberto((prev) => !prev);
                        }}
                      >
                        <Smile size={20} />
                      </button>

                      {/* Botão Anexo */}
                      <button
                        type="button"
                        className="wa-btn-icon"
                        title="Anexar Imagem ou Arquivo"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip size={20} />
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImagemPrevia({ url: URL.createObjectURL(file), base64: reader.result as string, file });
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />

                      <input
                        type="file"
                        ref={docInputRef}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setDocPrevia({ url: URL.createObjectURL(file), base64: reader.result as string, file });
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />

                      {/* Textarea Auto-expansível */}
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder={
                          modoComposicao === "nota"
                            ? "Escreva uma nota interna (RN-044 — visível apenas para os atendentes, nunca enviada ao WhatsApp)..."
                            : imagemPrevia
                            ? "Digite uma legenda para a imagem…"
                            : "Digite uma mensagem (ou digite / para respostas rápidas)"
                        }
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (imagemPrevia) {
                              void enviarImagemAnexada();
                            } else if (docPrevia) {
                              void enviarDocumentoAnexado();
                            } else {
                              void enviarTexto();
                            }
                          }
                        }}
                      />

                      {/* Botão Gravar Áudio (ao lado do Enviar - apenas em modo mensagem) */}
                      {modoComposicao === "mensagem" && (
                        <button
                          type="button"
                          className="wa-btn-icon wa-mic-btn"
                          title="Gravar áudio"
                          onClick={iniciarGravacaoAudio}
                        >
                          <Mic size={20} />
                        </button>
                      )}

                      {/* Botão Enviar */}
                      <button
                        type="submit"
                        className="wa-send-btn"
                        disabled={enviando || (!draft.trim() && !imagemPrevia && !docPrevia)}
                        title={modoComposicao === "nota" ? "Salvar Nota Interna (RN-044)" : "Enviar mensagem"}
                        style={modoComposicao === "nota" ? { backgroundColor: "#d97706" } : undefined}
                      >
                        {enviando ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : modoComposicao === "nota" ? (
                          <Lock size={16} />
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                    </>
                  )}
                </form>

                <div className="wa-composer-hint">
                  {modoComposicao === "nota"
                    ? "Enter para salvar nota interna · Shift + Enter para nova linha · Visível apenas para a equipe"
                    : "Enter para enviar · Shift + Enter para nova linha · Digite / para respostas rápidas"}
                </div>

                {/* Catálogo Flutuante de Emojis */}
                {emojiPickerAberto && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: 16,
                      background: "var(--panel, #ffffff)",
                      border: "1px solid var(--line, #e2e8e4)",
                      borderRadius: 12,
                      padding: 12,
                      boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                      zIndex: 20,
                      width: 330,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
                      {(Object.keys(EMOJI_CATEGORIAS) as (keyof typeof EMOJI_CATEGORIAS)[]).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`wa-chip ${catEmojiAtiva === cat ? "selected" : ""}`}
                          style={{ padding: "3px 8px", fontSize: 10 }}
                          onClick={() => setCatEmojiAtiva(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(8, 1fr)",
                        gap: 4,
                        maxHeight: 180,
                        overflowY: "auto",
                      }}
                    >
                      {EMOJI_CATEGORIAS[catEmojiAtiva].map((em) => (
                        <button
                          key={em}
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            fontSize: 22,
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: 6,
                          }}
                          onClick={() => {
                            setDraft((prev) => prev + em);
                            if (textareaRef.current) textareaRef.current.focus();
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. BARRA LATERAL DE BASTIDORES (IA HUDSON) */}
            {painelBastidoresAberto && (
              <aside className="wa-bastidores-sidebar">
                {/* Header */}
                <div className="wa-bastidores-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BrainCircuit size={17} color="#22c55e" />
                    <div>
                      <strong style={{ fontSize: 13, display: "block", lineHeight: 1.2 }}>Bastidores da Venda</strong>
                      <span style={{ fontSize: 10.5, color: "var(--fg-3)" }}>Inteligência Hudson IA</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="wa-btn-icon"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setPainelBastidoresAberto(false)}
                    title="Ocultar bastidores"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="wa-bastidores-content">
                  {/* 1. Controle da IA para este chat */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 8,
                      backgroundColor: sel.iaAtiva ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 255, 255, 0.04)",
                      border: `1px solid ${sel.iaAtiva ? "rgba(34, 197, 94, 0.28)" : "var(--border-subtle, rgba(255,255,255,0.08))"}`,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 12, display: "block", color: sel.iaAtiva ? "#22c55e" : "var(--fg-2)" }}>
                        {sel.iaAtiva ? "🤖 IA Responde Automático" : "⚪ Atendimento Manual"}
                      </strong>
                      <span style={{ fontSize: 10, color: "var(--fg-3)" }}>
                        {sel.iaAtiva ? "Hudson responde o cliente sem intervenção" : "Apenas sugestões manuais"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => alternarIaConversa(sel.id)}
                      style={{
                        backgroundColor: sel.iaAtiva ? "#22c55e" : "var(--bg-3, #e2e8e4)",
                        color: sel.iaAtiva ? "#ffffff" : "var(--fg-1)",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {sel.iaAtiva ? "Pausar" : "Ligar"}
                    </button>
                  </div>

                  {/* Status e Configuração da Chave de IA */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px", marginTop: -6 }}>
                    <span style={{ fontSize: 10, color: temChaveIa ? "#22c55e" : "#eab308", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: temChaveIa ? "#22c55e" : "#eab308" }} />
                      {temChaveIa ? "Chave de IA configurada" : "Chave de IA pendente"}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAiKeyInput(customAiKey); setModalAiKeyAberto(true); }}
                      style={{ background: "none", border: "none", color: temChaveIa ? "var(--fg-3)" : "#eab308", fontSize: 10, cursor: "pointer", textDecoration: "underline", fontWeight: temChaveIa ? 400 : 700 }}
                    >
                      {temChaveIa ? "Alterar chave" : "Configurar agora"}
                    </button>
                  </div>

                  {/* 2. Ponto de Atenção da IA (se houver) */}
                  {sel.bastidores?.atencao && (
                    <div className="wa-bastidores-alert">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4 }}>
                        <AlertTriangle size={14} /> Ponto de Atenção da IA
                      </div>
                      <div style={{ lineHeight: 1.4 }}>{sel.bastidores.atencao}</div>
                    </div>
                  )}

                  {/* 3. Estado do Atendimento (Ticket - RN-041 a RN-048) */}
                  <div className="wa-bastidores-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase" }}>
                        Estado do Atendimento (Ticket)
                      </strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor:
                            sel.status === "Encerrado" || sel.status === "Resolvido"
                              ? "rgba(100, 116, 139, 0.15)"
                              : "rgba(34, 197, 94, 0.15)",
                          color:
                            sel.status === "Encerrado" || sel.status === "Resolvido"
                              ? "#64748b"
                              : "#22c55e",
                        }}
                      >
                        {sel.status || "Em atendimento"}
                      </span>
                    </div>
                    <select
                      value={sel.status || "Em atendimento"}
                      onChange={(e) => atualizarConversa(sel.id, (c) => ({ ...c, status: e.target.value as any }))}
                      style={{
                        width: "100%",
                        fontSize: 11.5,
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle, #e2e8e4)",
                        background: "var(--bg-2, #ffffff)",
                        color: "var(--fg-1)",
                        cursor: "pointer",
                      }}
                    >
                      {ESTADOS_ATENDIMENTO.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Etapa do Funil e Oportunidade Comercial (RN-060 a RN-067) */}
                  <div className="wa-bastidores-card">
                    <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Oportunidade Comercial (A.P.O.N.T.E.)
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 12,
                          backgroundColor: "rgba(34, 197, 94, 0.15)",
                          color: "#22c55e",
                          fontWeight: 700,
                          fontSize: 11.5,
                        }}
                      >
                        {sel.bastidores?.etapa || sel.etapa}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--fg-3)" }}>R$</span>
                        <input
                          type="number"
                          value={sel.valor || ""}
                          placeholder="0,00"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            atualizarConversa(sel.id, (c) => ({ ...c, valor: val }));
                          }}
                          style={{
                            width: 80,
                            fontSize: 11.5,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid var(--border-subtle, #e2e8e4)",
                            background: "var(--bg-2, #ffffff)",
                            color: "var(--fg-1)",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {ETAPAS.map((et) => (
                        <button
                          key={et}
                          type="button"
                          onClick={() => atualizarConversa(sel.id, (c) => ({ ...c, etapa: et }))}
                          style={{
                            fontSize: 10.5,
                            padding: "3px 8px",
                            borderRadius: 8,
                            border: "1px solid var(--border-subtle, #e2e8e4)",
                            background: sel.etapa === et ? "rgba(34, 197, 94, 0.2)" : "transparent",
                            color: sel.etapa === et ? "#22c55e" : "var(--fg-2)",
                            fontWeight: sel.etapa === et ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {et}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.06))" }}>
                      <button
                        type="button"
                        onClick={() => atualizarConversa(sel.id, (c) => ({ ...c, resultado: "Ganho", perda: null }))}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: "none",
                          backgroundColor: sel.resultado === "Ganho" ? "#16a34a" : "rgba(34, 197, 94, 0.15)",
                          color: sel.resultado === "Ganho" ? "#ffffff" : "#16a34a",
                          cursor: "pointer",
                        }}
                      >
                        ✓ Ganho
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalPerdaAberto(true)}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: "none",
                          backgroundColor: sel.resultado === "Perdido" ? "#dc2626" : "rgba(239, 68, 68, 0.12)",
                          color: sel.resultado === "Perdido" ? "#ffffff" : "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        ✕ Perdida (RN-066)
                      </button>
                    </div>
                  </div>

                  {/* 4. Score da Conversa / Autoavaliação */}
                  {sel.bastidores?.nota && (
                    <div className="wa-bastidores-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase" }}>Score da Conversa</strong>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#22c55e" }}>
                          {sel.bastidores.nota.includes("=") ? sel.bastidores.nota.split("=")[1]?.trim() : sel.bastidores.nota}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {sel.bastidores.nota}
                      </div>
                    </div>
                  )}

                  {/* 5. Dados do Lead Identificados */}
                  <div className="wa-bastidores-card">
                    <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      Dados Identificados pela IA
                    </strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                      <div>
                        <span style={{ color: "var(--fg-3)" }}>Veículo: </span>
                        <strong>
                          {sel.carro ||
                            (sel.bastidores?.dados?.includes("Veículo:")
                              ? sel.bastidores.dados.split("Veículo:")[1]?.split("|")[0]?.trim()
                              : "Aguardando identificação")}
                        </strong>
                      </div>
                      {sel.bastidores?.dados && (
                        <div>
                          <span style={{ color: "var(--fg-3)" }}>Ficha: </span>
                          <span>{sel.bastidores.dados}</span>
                        </div>
                      )}
                      <div>
                        <span style={{ color: "var(--fg-3)" }}>Produtos/Valores: </span>
                        <span>{sel.bastidores?.produtos || "Nenhum no momento"}</span>
                      </div>
                    </div>
                  </div>

                  {/* 6. Etiquetas do Lead */}
                  <div className="wa-bastidores-card">
                    <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Etiquetas Atribuídas
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {(sel.tags?.length ? sel.tags : ["WhatsApp"]).map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 6,
                            backgroundColor: "rgba(22, 132, 91, 0.12)",
                            color: "#16845b",
                            border: "1px solid rgba(22, 132, 91, 0.25)",
                            fontWeight: 600,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 7. Próximas Respostas Previstas (Sugestões Hudson) */}
                  {chatSuggestions.length > 0 && (
                    <div className="wa-bastidores-card">
                      <strong style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                        O que o cliente deve responder:
                      </strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {chatSuggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDraft(sug);
                              if (textareaRef.current) textareaRef.current.focus();
                            }}
                            style={{
                              textAlign: "left",
                              fontSize: 11.5,
                              padding: "6px 10px",
                              borderRadius: 8,
                              backgroundColor: "rgba(34, 197, 94, 0.08)",
                              color: "#22c55e",
                              border: "1px solid rgba(34, 197, 94, 0.2)",
                              cursor: "pointer",
                            }}
                            title="Inserir no campo de resposta"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 8. Registro Detalhado dos Bastidores */}
                  {sel.bastidores?.raw && (
                    <details style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 6 }}>
                        Ver Registro Completo de Bastidores
                      </summary>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          fontSize: 10.5,
                          padding: 8,
                          borderRadius: 6,
                          backgroundColor: "rgba(0,0,0,0.05)",
                          border: "1px solid var(--border-subtle, #e2e8e4)",
                          maxHeight: 180,
                          overflowY: "auto",
                        }}
                      >
                        {sel.bastidores.raw}
                      </pre>
                    </details>
                  )}
                </div>
              </aside>
            )}
          </div>
            </>
          )}
        </main>
      </div>

      {/* 4. NOTIFICAÇÕES POPUP FLUTUANTES (NO RODAPÉ DIREITO) */}
      <div className="wa-notification-stack">
        {popups.map((p) => (
          <article key={p.id} className="wa-message-popup">
            <div className="wa-avatar" style={{ width: 34, height: 34 }}>
              💬
            </div>
            <button
              type="button"
              className="wa-popup-main"
              onClick={() => {
                if (p.jid) setSelId(p.jid);
                setPopups((prev) => prev.filter((x) => x.id !== p.id));
              }}
            >
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </button>
            <button
              type="button"
              style={{ background: "transparent", border: "none", color: "var(--fg-3)", cursor: "pointer" }}
              onClick={() => setPopups((prev) => prev.filter((x) => x.id !== p.id))}
            >
              <X size={16} />
            </button>
          </article>
        ))}
      </div>

      {/* 5. MENU DE CONTEXTO (BOTÃO DIREITO) */}
      {contextMenu && (
        <div
          className="wa-context-menu"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 260) }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* LIGAR / DESLIGAR IA NA CONVERSA PELO MENU DE CONTEXTO */}
          <button
            type="button"
            onClick={() => {
              alternarIaConversa(contextMenu.conversa.id);
              setContextMenu(null);
            }}
          >
            <Bot size={15} color={contextMenu.conversa.iaAtiva ? "#22c55e" : undefined} />
            {contextMenu.conversa.iaAtiva ? "Desligar IA nesta conversa" : "Ligar IA nesta conversa"}
          </button>

          <button
            type="button"
            onClick={() => {
              atualizarConversa(contextMenu.conversa.id, (c) => ({ ...c, fixada: !c.fixada }));
              setContextMenu(null);
            }}
          >
            <Pin size={15} /> {contextMenu.conversa.fixada ? "Desafixar conversa" : "Fixar conversa"}
          </button>

          <button
            type="button"
            onClick={() => {
              atualizarConversa(contextMenu.conversa.id, (c) => ({
                ...c,
                naoLida: c.naoLida > 0 ? 0 : 1,
              }));
              setContextMenu(null);
            }}
          >
            <CheckCheck size={15} /> {contextMenu.conversa.naoLida > 0 ? "Marcar como lida" : "Marcar como não lida"}
          </button>

          <button
            type="button"
            onClick={() => {
              atualizarConversa(contextMenu.conversa.id, (c) => ({
                ...c,
                silenciada: !c.silenciada,
              }));
              setContextMenu(null);
            }}
          >
            {contextMenu.conversa.silenciada ? <Bell size={15} /> : <BellOff size={15} />}
            {contextMenu.conversa.silenciada ? "Reativar alertas" : "Silenciar alertas"}
          </button>

          <button
            type="button"
            onClick={() => {
              atualizarConversa(contextMenu.conversa.id, (c) => ({
                ...c,
                arquivada: !c.arquivada,
              }));
              setContextMenu(null);
            }}
          >
            <Archive size={15} /> {contextMenu.conversa.arquivada ? "Desarquivar conversa" : "Arquivar conversa"}
          </button>

          <button
            type="button"
            onClick={() => {
              setSelId(contextMenu.conversa.id);
              setModalAberto("contactDetails");
              setContextMenu(null);
            }}
          >
            <Tag size={15} /> Etiquetas e atendimento
          </button>

          <button
            type="button"
            onClick={() => {
              setSelId(contextMenu.conversa.id);
              setNovoAgendamentoTipo("reminder");
              setModalAberto("jobs");
              setContextMenu(null);
            }}
          >
            <Clock size={15} /> Criar lembrete
          </button>
        </div>
      )}

      {/* 6. MODAL DE CONFIGURAÇÕES E PREFERÊNCIAS */}
      {modalAberto === "settings" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Ferramentas de Atendimento</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas */}
            <div className="wa-settings-tabs">
              <button
                type="button"
                className={`wa-chip ${abaConfig === "preferences" ? "selected" : ""}`}
                onClick={() => setAbaConfig("preferences")}
              >
                Preferências
              </button>
              <button
                type="button"
                className={`wa-chip ${abaConfig === "tags" ? "selected" : ""}`}
                onClick={() => setAbaConfig("tags")}
              >
                Etiquetas ({tags.length})
              </button>
              <button
                type="button"
                className={`wa-chip ${abaConfig === "replies" ? "selected" : ""}`}
                onClick={() => setAbaConfig("replies")}
              >
                Respostas rápidas ({replies.length})
              </button>
              <button
                type="button"
                className={`wa-chip ${abaConfig === "automation" ? "selected" : ""}`}
                onClick={() => setAbaConfig("automation")}
              >
                Automação
              </button>
            </div>

            {/* Aba 1: Preferências */}
            {abaConfig === "preferences" && (
              <div>
                <label className="wa-form-check">
                  <input
                    type="checkbox"
                    checked={prefs.sound}
                    onChange={(e) => setPrefs((p) => ({ ...p, sound: e.target.checked }))}
                  />
                  Sons de novas mensagens recebidas
                </label>

                <div className="wa-form-group">
                  <label>Volume do alerta: {Math.round(prefs.volume * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={prefs.volume}
                    onChange={(e) => setPrefs((p) => ({ ...p, volume: Number(e.target.value) }))}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                    onClick={() => playWebAudioBeep(prefs.volume)}
                  >
                    <Volume2 size={14} /> Testar som do painel
                  </button>
                </div>

                <label className="wa-form-check">
                  <input
                    type="checkbox"
                    checked={prefs.popup}
                    onChange={(e) => setPrefs((p) => ({ ...p, popup: e.target.checked }))}
                  />
                  Popup flutuante dentro do painel
                </label>

                <label className="wa-form-check">
                  <input
                    type="checkbox"
                    checked={prefs.preview}
                    onChange={(e) => setPrefs((p) => ({ ...p, preview: e.target.checked }))}
                  />
                  Mostrar conteúdo da mensagem no popup
                </label>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ alignSelf: "flex-start", marginBottom: 14 }}
                  onClick={() => dispararPopup("Alerta de teste", "Assim aparecerá uma nova notificação do painel.")}
                >
                  Testar notificação popup
                </button>

                <div className="wa-form-group">
                  <label>Tamanho das mensagens</label>
                  <select
                    value={prefs.font}
                    onChange={(e) => setPrefs((p) => ({ ...p, font: e.target.value as any }))}
                  >
                    <option value="small">Pequeno</option>
                    <option value="normal">Normal</option>
                    <option value="large">Grande</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setModalAberto("none")}
                >
                  Salvar preferências
                </button>
              </div>
            )}

            {/* Aba 2: Gestão de Etiquetas */}
            {abaConfig === "tags" && (
              <div>
                <p style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 12 }}>
                  Gerencie as etiquetas do seu funil e atendimento:
                </p>

                <div className="wa-management-list">
                  {tags.map((t) => (
                    <div key={t.id} className="wa-management-item">
                      <span className="wa-color-dot" style={{ backgroundColor: t.color }} />
                      <strong style={{ flex: 1 }}>{t.name}</strong>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        style={{ width: 28, height: 28, color: "#ef4444" }}
                        title="Excluir etiqueta"
                        onClick={() => setTags((prev) => prev.filter((x) => x.id !== t.id))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={criarEtiqueta} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div className="wa-form-group" style={{ flex: 1, margin: 0 }}>
                    <label>Nova Etiqueta</label>
                    <input
                      type="text"
                      placeholder="Ex.: Troca de amortecedor"
                      value={novaTagNome}
                      onChange={(e) => setNovaTagNome(e.target.value)}
                    />
                  </div>
                  <div className="wa-form-group" style={{ width: 60, margin: 0 }}>
                    <label>Cor</label>
                    <input
                      type="color"
                      value={novaTagCor}
                      onChange={(e) => setNovaTagCor(e.target.value)}
                      style={{ padding: 2, height: 38 }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                    Adicionar
                  </button>
                </form>
              </div>
            )}

            {/* Aba 3: Gestão de Respostas Rápidas */}
            {abaConfig === "replies" && (
              <div>
                <p style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 12 }}>
                  Digite / no campo de mensagem para usar o atalho salvo.
                </p>

                <div className="wa-management-list">
                  {replies.map((r) => (
                    <div key={r.id} className="wa-management-item" style={{ alignItems: "flex-start" }}>
                      <strong style={{ color: "#16845b", minWidth: 90 }}>/{r.shortcut}</strong>
                      <span style={{ flex: 1, color: "var(--fg-2)" }}>{r.text}</span>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        style={{ width: 28, height: 28, color: "#ef4444" }}
                        title="Excluir resposta rápida"
                        onClick={() => setReplies((prev) => prev.filter((x) => x.id !== r.id))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={criarRespostaRapida} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="wa-form-group" style={{ margin: 0 }}>
                    <label>Atalho (sem a barra)</label>
                    <input
                      type="text"
                      placeholder="exemplo: pix"
                      value={novoAtalho}
                      onChange={(e) => setNovoAtalho(e.target.value)}
                    />
                  </div>
                  <div className="wa-form-group" style={{ margin: 0 }}>
                    <label>Texto da Resposta</label>
                    <textarea
                      rows={3}
                      placeholder="Digite o texto que será preenchido automaticamente…"
                      value={novoTextoResposta}
                      onChange={(e) => setNovoTextoResposta(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
                    Salvar Resposta Rápida
                  </button>
                </form>
              </div>
            )}

            {/* Aba 4: Automação (Saudação e Ausência) */}
            {abaConfig === "automation" && (
              <div>
                <div style={{ marginBottom: 18, borderBottom: "1px solid var(--line, #e2e8e4)", paddingBottom: 14 }}>
                  <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Mensagem de Saudação</h3>
                  <label className="wa-form-check">
                    <input
                      type="checkbox"
                      checked={automation.greeting.enabled}
                      onChange={(e) =>
                        setAutomation((prev) => ({
                          ...prev,
                          greeting: { ...prev.greeting, enabled: e.target.checked },
                        }))
                      }
                    />
                    Ativar saudação para novos contatos
                  </label>
                  <textarea
                    rows={2}
                    value={automation.greeting.text}
                    onChange={(e) =>
                      setAutomation((prev) => ({
                        ...prev,
                        greeting: { ...prev.greeting, text: e.target.value },
                      }))
                    }
                    placeholder="Texto da saudação…"
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--line, #e2e8e4)" }}
                  />
                </div>

                <div>
                  <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Mensagem de Ausência (Fora do Horário)</h3>
                  <label className="wa-form-check">
                    <input
                      type="checkbox"
                      checked={automation.away.enabled}
                      onChange={(e) =>
                        setAutomation((prev) => ({
                          ...prev,
                          away: { ...prev.away, enabled: e.target.checked },
                        }))
                      }
                    />
                    Responder automaticamente fora do horário de atendimento
                  </label>
                  <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--fg-3)" }}>Horário de abertura:</label>
                      <input
                        type="time"
                        value={automation.away.start}
                        onChange={(e) =>
                          setAutomation((prev) => ({
                            ...prev,
                            away: { ...prev.away, start: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--fg-3)" }}>Horário de fechamento:</label>
                      <input
                        type="time"
                        value={automation.away.end}
                        onChange={(e) =>
                          setAutomation((prev) => ({
                            ...prev,
                            away: { ...prev.away, end: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={automation.away.text}
                    onChange={(e) =>
                      setAutomation((prev) => ({
                        ...prev,
                        away: { ...prev.away, text: e.target.value },
                      }))
                    }
                    placeholder="Texto de aviso de ausência…"
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--line, #e2e8e4)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL DE AGENDAMENTOS E LEMBRETES */}
      {modalAberto === "jobs" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Agendamentos e Lembretes</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            {sel && (
              <form onSubmit={criarAgendamento} style={{ background: "rgba(0,0,0,0.03)", padding: 14, borderRadius: 10, marginBottom: 18 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13 }}>
                  Criar {novoAgendamentoTipo === "message" ? "Mensagem Agendada" : "Lembrete"} para {sel.nome}
                </h4>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <select
                    value={novoAgendamentoTipo}
                    onChange={(e) => setNovoAgendamentoTipo(e.target.value as any)}
                    style={{ width: 160 }}
                  >
                    <option value="message">Mensagem p/ Contato</option>
                    <option value="reminder">Lembrete Interno</option>
                  </select>

                  <input
                    type="datetime-local"
                    value={novoAgendamentoData}
                    onChange={(e) => setNovoAgendamentoData(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder={novoAgendamentoTipo === "message" ? "Texto da mensagem a ser enviada…" : "O que você precisa lembrar sobre este lead?"}
                  value={novoAgendamentoTexto}
                  onChange={(e) => setNovoAgendamentoTexto(e.target.value)}
                  required
                  style={{ width: "100%", marginBottom: 8 }}
                />

                <button type="submit" className="btn btn-primary btn-sm">
                  Salvar {novoAgendamentoTipo === "message" ? "Agendamento" : "Lembrete"}
                </button>
              </form>
            )}

            <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Fila de Agendamentos e Lembretes:</h4>
            <div className="wa-management-list">
              {jobs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--fg-3)", fontSize: 12 }}>
                  Nenhum agendamento ou lembrete na fila.
                </div>
              ) : (
                jobs.map((j) => (
                  <div key={j.id} className="wa-management-item">
                    <span className="wa-stage" style={{ backgroundColor: j.kind === "message" ? "#dcfce7" : "#fef3c7" }}>
                      {j.kind === "message" ? "Mensagem" : "Lembrete"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{j.contatoNome}</strong> · <time style={{ fontSize: 11, color: "var(--fg-3)" }}>{new Date(j.at).toLocaleString("pt-BR")}</time>
                      <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{j.text}</div>
                    </div>
                    {j.status === "queued" && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ color: "#ef4444" }}
                        onClick={() => setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: "cancelled" } : x)))}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE MENSAGENS FAVORITAS */}
      {modalAberto === "favorites" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Mensagens Favoritas</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            <div className="wa-management-list">
              {todasFavoritas.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--fg-3)", fontSize: 13 }}>
                  Use a estrela ☆ ao passar o mouse em qualquer mensagem para guardá-la aqui.
                </div>
              ) : (
                todasFavoritas.map(({ chat, msg }) => (
                  <div key={msg.id} className="wa-management-item" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <strong>{chat.nome} ({msg.kind === "vendedor" ? "Você" : "Cliente"})</strong>
                        <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{msg.t}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-2)" }}>{msg.text}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSelId(chat.id);
                        setModalAberto("none");
                        setTimeout(() => {
                          const el = document.getElementById(`msg-${msg.id}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 200);
                      }}
                    >
                      Abrir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL DE ARQUIVOS, LINKS E HISTÓRICO (GALERIA) */}
      {modalAberto === "history" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Arquivos, Mídias e Links {sel ? `· ${sel.nome}` : ""}</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            <div className="wa-settings-tabs">
              <button
                type="button"
                className={`wa-chip ${abaGaleria === "all" ? "selected" : ""}`}
                onClick={() => setAbaGaleria("all")}
              >
                Tudo
              </button>
              <button
                type="button"
                className={`wa-chip ${abaGaleria === "image" ? "selected" : ""}`}
                onClick={() => setAbaGaleria("image")}
              >
                Fotos & Vídeos
              </button>
              <button
                type="button"
                className={`wa-chip ${abaGaleria === "audio" ? "selected" : ""}`}
                onClick={() => setAbaGaleria("audio")}
              >
                Áudios
              </button>
              <button
                type="button"
                className={`wa-chip ${abaGaleria === "document" ? "selected" : ""}`}
                onClick={() => setAbaGaleria("document")}
              >
                Documentos
              </button>
              <button
                type="button"
                className={`wa-chip ${abaGaleria === "links" ? "selected" : ""}`}
                onClick={() => setAbaGaleria("links")}
              >
                Links
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, maxHeight: 380, overflowY: "auto" }}>
              {(sel ? sel.msgs : lista.flatMap((c) => c.msgs))
                .filter((m) => {
                  if (abaGaleria === "all") return m.mediaType || /https?:\/\//.test(m.text);
                  if (abaGaleria === "image") return m.mediaType === "image" || m.mediaType === "video";
                  if (abaGaleria === "audio") return m.mediaType === "audio";
                  if (abaGaleria === "document") return m.mediaType === "document";
                  if (abaGaleria === "links") return /https?:\/\//.test(m.text);
                  return true;
                })
                .map((m) => (
                  <div
                    key={m.id}
                    style={{
                      border: "1px solid var(--line, #e2e8e4)",
                      borderRadius: 8,
                      padding: 8,
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    {m.mediaType === "image" && m.mediaUrl && (
                      <img
                        src={m.mediaUrl}
                        alt="Foto"
                        style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 6, cursor: "pointer" }}
                        onClick={() => setImagemLightbox(m.mediaUrl!)}
                      />
                    )}
                    {m.mediaType === "audio" && m.mediaUrl && (
                      <audio controls src={m.mediaUrl} style={{ width: "100%", marginTop: 4 }} />
                    )}
                    {m.mediaType === "document" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
                        <FileText size={20} color="#16845b" />
                        <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.fileName || "Documento"}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>{m.t} · {m.nome || "Mensagem"}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL DE NOVA CONVERSA */}
      {modalAberto === "newChat" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Nova Conversa de WhatsApp</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={iniciarNovaConversa}>
              <div className="wa-form-group">
                <label>Número do WhatsApp (com DDD)</label>
                <input
                  type="tel"
                  placeholder="Ex.: 61 99999-9999"
                  value={novoNumero}
                  onChange={(e) => setNovoNumero(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="wa-form-group">
                <label>Nome do Contato (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex.: Carlos Silva (Corolla)"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 8 }}>
                Iniciar Atendimento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 11. MODAL DE DADOS E ETIQUETAS DO CONTATO */}
      {modalAberto === "contactDetails" && sel && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Atendimento · {sel.nome}</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            {!sel.id.endsWith('@g.us') && <div className="wa-form-group">
              <label htmlFor="wa-contact-phone">Número do WhatsApp</label>
              <input id="wa-contact-phone" type="tel" readOnly value={sel.tel || 'Número indisponível'} onFocus={event => event.currentTarget.select()} />
            </div>}

            <div className="wa-form-group">
              <label>Etapa do Funil</label>
              <select
                value={sel.etapa}
                onChange={(e) =>
                  atualizarConversa(sel.id, (c) => ({
                    ...c,
                    etapa: e.target.value as any,
                  }))
                }
              >
                {ETAPAS.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div className="wa-form-group">
              <label>Etiquetas do Lead</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                {tags.map((t) => {
                  const tagAtiva = sel.tags?.includes(t.name.toLowerCase());
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="wa-chip"
                      style={{
                        backgroundColor: tagAtiva ? t.color : undefined,
                        color: tagAtiva ? "#ffffff" : undefined,
                        borderColor: tagAtiva ? t.color : undefined,
                      }}
                      onClick={() => {
                        const cur = sel.tags || [];
                        const next = tagAtiva
                          ? cur.filter((x) => x !== t.name.toLowerCase())
                          : [...cur, t.name.toLowerCase()];
                        atualizarConversa(sel.id, (c) => ({ ...c, tags: next }));
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wa-form-group">
              <label>Veículo / Serviço</label>
              <input
                type="text"
                placeholder="Ex.: Civic 2020 - Troca de óleo"
                value={sel.carro || ""}
                onChange={(e) =>
                  atualizarConversa(sel.id, (c) => ({ ...c, carro: e.target.value }))
                }
              />
            </div>

            <div className="wa-form-group">
              <label>Anotações Internas do Contato</label>
              <textarea
                rows={4}
                placeholder="Informações visíveis apenas para os atendentes neste painel…"
                value={sel.notas?.[0]?.texto || ""}
                onChange={(e) => {
                  const txt = e.target.value;
                  atualizarConversa(sel.id, (c) => ({
                    ...c,
                    notas: [{ id: "n-1", t: hhmm(), autor: "Atendente", texto: txt }],
                  }));
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => setModalAberto("none")}
            >
              Concluir e Fechar
            </button>
          </div>
        </div>
      )}

      {/* 12. MODAL DE STATUS DA CONEXÃO EVOLUTION */}
      {modalAberto === "connection" && (
        <div className="wa-modal-backdrop" onClick={() => setModalAberto("none")}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2>Conexão WhatsApp · Evolution API</h2>
              <button
                type="button"
                className="wa-btn-icon"
                onClick={() => setModalAberto("none")}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  backgroundColor: evoStatus?.state === "open" ? "#dcfce7" : "#fee2e2",
                  color: evoStatus?.state === "open" ? "#16a34a" : "#dc2626",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                }}
              >
                <LinkIcon size={26} />
              </div>

              <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>
                {evoStatus?.state === "open" ? "WhatsApp Conectado e Operando" : "Status: " + (evoStatus?.state || "Verificando…")}
              </h3>

              <p style={{ fontSize: 13, color: "var(--fg-3)", maxWidth: 360, margin: "0 auto 16px" }}>
                Conta: <strong>{activeAccount.nome}</strong> ({activeAccount.tipo})<br />
                Instância ativa: <strong>{instanceName}</strong><br />
                Total de conversas: <strong>{evoStatus?.chatsCount ?? 0}</strong>
              </p>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  void carregarStatus();
                }}
              >
                <RefreshCw size={13} /> Atualizar Conexão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE MOTIVO DE PERDA (RN-066) */}
      {modalPerdaAberto && (
        <div className="wa-modal-backdrop" onClick={() => setModalPerdaAberto(false)}>
          <div className="wa-modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={18} /> Registrar Motivo de Perda (RN-066)
              </h2>
              <button type="button" className="wa-btn-icon" onClick={() => setModalPerdaAberto(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--fg-2)", marginBottom: 12 }}>
                Conforme as regras de negócio do CRM, o registro do motivo é obrigatório para auditoria comercial e relatórios de conversão.
              </p>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--fg-2)", marginBottom: 4 }}>
                Motivo da Perda *
              </label>
              <select
                value={motivoPerdaSelecionado}
                onChange={(e) => setMotivoPerdaSelecionado(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle, #e2e8e4)",
                  background: "var(--bg-2, #ffffff)",
                  color: "var(--fg-1)",
                  marginBottom: 12,
                }}
              >
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--fg-2)", marginBottom: 4 }}>
                Detalhes adicionais (opcional)
              </label>
              <textarea
                rows={3}
                value={detalhesPerda}
                onChange={(e) => setDetalhesPerda(e.target.value)}
                placeholder="Ex: Cliente achou a troca de 4 pneus 205/55R16 cara comparado ao concorrente..."
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle, #e2e8e4)",
                  background: "var(--bg-2, #ffffff)",
                  color: "var(--fg-1)",
                  resize: "vertical",
                  marginBottom: 16,
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setModalPerdaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ backgroundColor: "#dc2626", color: "#ffffff", border: "none" }}
                  onClick={() => {
                    if (!sel) return;
                    const notaPerda = `[OPORTUNIDADE PERDIDA - RN-066] Motivo: ${motivoPerdaSelecionado}${
                      detalhesPerda.trim() ? ` | Detalhes: ${detalhesPerda.trim()}` : ""
                    }`;
                    atualizarConversa(sel.id, (c) => ({
                      ...c,
                      resultado: "Perdido",
                      perda: motivoPerdaSelecionado,
                      log: [{ t: hhmm(), text: notaPerda }, ...c.log],
                    }));
                    setModalPerdaAberto(false);
                    setDetalhesPerda("");
                  }}
                >
                  Confirmar Perda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. MODAL DE CONFIGURAÇÃO DA CHAVE DE IA HUDSON */}
      {modalAiKeyAberto && (
        <div className="wa-modal-backdrop" onClick={() => setModalAiKeyAberto(false)}>
          <div className="wa-modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Bot size={20} color="#22c55e" /> Configurar IA Hudson
              </h2>
              <button type="button" className="wa-btn-icon" onClick={() => setModalAiKeyAberto(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--fg-2)", marginBottom: 14, lineHeight: 1.5 }}>
                Para a IA Hudson responder automaticamente seus clientes no WhatsApp e sugerir orçamentos conforme as regras comerciais do Grupo Ômega, insira sua chave do <strong>Google Gemini</strong> (gratuita) ou <strong>Lovable API Key</strong>:
              </p>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--fg-2)", marginBottom: 6 }}>
                Chave da API (Gemini ou Lovable) *
              </label>
              <input
                type="text"
                className="input"
                style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace", borderRadius: 6, marginBottom: 10 }}
                placeholder="Cole aqui: AIzaSy... ou lovable_..."
                value={aiKeyInput}
                onChange={(e) => setAiKeyInput(e.target.value)}
              />

              <div style={{ fontSize: 11.5, color: "var(--fg-3)", backgroundColor: "var(--inset)", padding: "10px 12px", borderRadius: 6, marginBottom: 16, lineHeight: 1.4 }}>
                💡 <strong>Como obter uma chave gratuita:</strong>
                <br />
                Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "#22c55e", textDecoration: "underline" }}>Google AI Studio</a>, faça login com sua conta Google e clique em <em>Create API key</em>. O modelo Gemini 1.5 Flash possui plano gratuito para atendimento.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalAiKeyAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!aiKeyInput.trim() || salvandoKey}
                  onClick={() => void salvarChaveIa(aiKeyInput)}
                >
                  {salvandoKey ? "Salvando…" : "Salvar e Ativar IA"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 13. LIGHTBOX DE IMAGEM AMPLIADA */}
      {imagemLightbox && (
        <div className="wa-lightbox" onClick={() => setImagemLightbox(null)}>
          <div className="wa-lightbox-header">
            <a
              href={imagemLightbox}
              download="whatsapp-imagem.jpg"
              className="btn btn-outline btn-sm"
              style={{ color: "#ffffff", borderColor: "#ffffff" }}
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={14} /> Baixar
            </a>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: "#ffffff", borderColor: "#ffffff" }}
              onClick={() => setImagemLightbox(null)}
            >
              <X size={15} /> Fechar
            </button>
          </div>
          <img src={imagemLightbox} alt="Imagem ampliada" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
