import { describe, it, expect } from "vitest";
import { parseAiOutput, parseSuggestions } from "@/lib/omega-chat.functions";

describe("Chatbot IA - Funções e Parsing", () => {
  it("deve extrair sugestões de resposta rápida formatadas como [[SUGESTÕES:...]]", () => {
    const raw = "Olá! Como posso te ajudar hoje?\n\n[[SUGESTÕES: Troca de Óleo | Pneus Novos | Falar com Consultor]]";
    const { cleanContent, suggestions } = parseSuggestions(raw);

    expect(cleanContent).toBe("Olá! Como posso te ajudar hoje?");
    expect(suggestions).toEqual(["Troca de Óleo", "Pneus Novos", "Falar com Consultor"]);
  });

  it("deve retornar o texto intacto e lista vazia quando não houver tag de sugestões", () => {
    const raw = "Perfeito, agendamento confirmado para amanhã às 14h.";
    const { cleanContent, suggestions } = parseSuggestions(raw);

    expect(cleanContent).toBe("Perfeito, agendamento confirmado para amanhã às 14h.");
    expect(suggestions).toEqual([]);
  });

  it("deve lidar com variação no singular [[SUGESTÃO:...]] e espaços extras", () => {
    const raw = "Seu orçamento ficou pronto! [[SUGESTÃO:  Aprovar ✅  |  Ajustar  ]]";
    const { cleanContent, suggestions } = parseSuggestions(raw);

    expect(cleanContent).toBe("Seu orçamento ficou pronto!");
    expect(suggestions).toEqual(["Aprovar ✅", "Ajustar"]);
  });

  it("deve separar completamente ### BASTIDORES do texto que vai para o cliente de WhatsApp", () => {
    const raw = `Com certeza, Gabriel! Vou te ajudar a encontrar as melhores opções para o seu veículo agora mesmo. 😊

Para eu não te passar nenhum valor errado e buscar o pneu exato no meu estoque, qual é o modelo do seu carro?

### BASTIDORES
ETAPA: P — Pesquisa (Identificação da Medida/Veículo)
ETIQUETA: Qualificado
DADOS: Nome: Gabriel Nunes | Necessidade: 3 pneus | Veículo: pendente
PRODUTOS: nada
ATENÇÃO: Cliente pediu 3 pneus; importante confirmar estado do 4º pneu na loja por segurança.
NOTA: Ab2 Qu2 Re— = 4/16

[[SUGESTÕES: É um Onix | É um HB20 | Vou olhar a medida]]`;

    const { cleanContent, suggestions, bastidores } = parseAiOutput(raw);

    // Mensagem enviada para o cliente NÃO PODE conter ### BASTIDORES
    expect(cleanContent).not.toContain("### BASTIDORES");
    expect(cleanContent).not.toContain("ETAPA:");
    expect(cleanContent).not.toContain("ETIQUETA:");
    expect(cleanContent).not.toContain("[[SUGESTÕES:");
    expect(cleanContent).toContain("Com certeza, Gabriel!");

    // Sugestões extraídas corretamente
    expect(suggestions).toEqual(["É um Onix", "É um HB20", "Vou olhar a medida"]);

    // Metadados de bastidores extraídos corretamente para o CRM
    expect(bastidores?.etapa).toBe("P — Pesquisa (Identificação da Medida/Veículo)");
    expect(bastidores?.etiqueta).toBe("Qualificado");
    expect(bastidores?.atencao).toBe("Cliente pediu 3 pneus; importante confirmar estado do 4º pneu na loja por segurança.");
    expect(bastidores?.nota).toBe("Ab2 Qu2 Re— = 4/16");
  });
});

