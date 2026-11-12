import { describe, expect, it } from "vitest";
import { filtrarConversas, type Conversa } from "@/components/inbox/dados";

const testConversas: Conversa[] = [
  { id: "d1", nome: "Lead 1", tel: "61999990001", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "Perdido", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: null, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m1", kind: "vendedor", text: "Pagamento via pix", t: "10:00" }], ficha: [], ag: null, log: [] },
  { id: "d2", nome: "Lead 2", tel: "61999990002", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: 10, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m2", kind: "cliente", text: "Olá", t: "10:01" }], ficha: [], ag: null, log: [] },
  { id: "d3", nome: "Lead 3", tel: "61999990003", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: 20, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m3", kind: "cliente", text: "Preço?", t: "10:02" }], ficha: [], ag: null, log: [] },
  { id: "d4", nome: "Lead 4", tel: "61999990004", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: 30, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m4", kind: "cliente", text: "Tem aro 15?", t: "10:03" }], ficha: [], ag: null, log: [] },
  { id: "d5", nome: "Lead 5", tel: "61999990005", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: 40, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m5", kind: "cliente", text: "Quero agendar", t: "10:04" }], ficha: [], ag: null, log: [] },
  { id: "d6", nome: "Lead 6", tel: "61999990006", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: 50, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m6", kind: "cliente", text: "Aceita chave pix?", t: "10:05" }], ficha: [], ag: null, log: [] },
  { id: "d7", nome: "Lead 7", tel: "(61) 99812-4420", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "Em atendimento humano", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: null, arquivada: false, naoLida: 0, tags: [], msgs: [{ id: "m7", kind: "vendedor", text: "Olá, como posso ajudar?", t: "10:06" }], ficha: [], ag: null, log: [] },
  { id: "d8", nome: "Lead 8", tel: "61999990008", origem: "", carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "Encerrada", valor: 0, perda: null, agente: "", data: "07/11", esperaMin: null, arquivada: true, naoLida: 0, tags: [], msgs: [], ficha: [], ag: null, log: [] },
];

describe("Inbox · filtros", () => {
  it("'Aguardando resposta' mostra só conversas abertas em que o cliente falou por último", () => {
    expect(filtrarConversas(testConversas, "", "resp").map((c) => c.id)).toEqual(["d2", "d3", "d4", "d5", "d6"]);
  });
  it("'Sem resposta do cliente' mostra conversas em que a loja falou por último", () => {
    expect(filtrarConversas(testConversas, "", "semresp").map((c) => c.id)).toEqual(["d7"]);
  });
  it("'Ativas' esconde arquivadas e perdidas", () => {
    expect(filtrarConversas(testConversas, "", "ativas").some((c) => c.id === "d8")).toBe(false);
    expect(filtrarConversas(testConversas, "", "arq").map((c) => c.id)).toEqual(["d8"]);
  });
  it("busca por telefone ignora pontuação", () => {
    expect(filtrarConversas(testConversas, "99812 4420", "todas").map((c) => c.id)).toEqual(["d7"]);
  });
  it("busca por palavra procura dentro das mensagens", () => {
    expect(filtrarConversas(testConversas, "pix", "todas").map((c) => c.id)).toEqual(["d1", "d6"]);
  });
});
