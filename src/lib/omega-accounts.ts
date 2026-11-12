import { useCallback, useEffect, useState } from "react";

export type Subconta = {
  id: string;
  nome: string;
  tipo: "Matriz" | "Franquia";
  resp: string;
  email: string;
  plano: "basico" | "pro" | "rede";
  instanceName: string;
  whatsappPhone: string;
  cor: string;
  loja: string;
};

export const CONTA_MATRIZ: Subconta = {
  id: "matriz",
  nome: "Grupo Ômega (Matriz)",
  tipo: "Matriz",
  resp: "Diretoria Geral",
  email: "contato@grupoomega.com.br",
  plano: "rede",
  instanceName: "teste-local",
  whatsappPhone: "(61) 99665-846",
  cor: "var(--lime)",
  loja: "Todas as Lojas (Matriz)",
};

export const SUBCONTA_MVP: Subconta = {
  id: "sub-asasul",
  nome: "Ômega Asa Sul (Franquia)",
  tipo: "Franquia",
  resp: "Ariel Gama",
  email: "asasul@grupoomega.com.br",
  plano: "pro",
  instanceName: "franquia-asasul",
  whatsappPhone: "(61) 99123-4567",
  cor: "#a855f7",
  loja: "Asa Sul",
};

export const CONTAS_DISPONIVEIS: Subconta[] = [CONTA_MATRIZ, SUBCONTA_MVP];

const STORAGE_KEY = "omega-active-account-id";

export function useActiveAccount() {
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return "matriz";
    return localStorage.getItem(STORAGE_KEY) || "matriz";
  });

  useEffect(() => {
    const handleAccountChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveId(customEvent.detail);
      } else {
        setActiveId(localStorage.getItem(STORAGE_KEY) || "matriz");
      }
    };

    window.addEventListener("omega-account-change", handleAccountChange);
    return () => window.removeEventListener("omega-account-change", handleAccountChange);
  }, []);

  const switchAccount = useCallback((id: string) => {
    const target = CONTAS_DISPONIVEIS.find((c) => c.id === id) || CONTA_MATRIZ;
    localStorage.setItem(STORAGE_KEY, target.id);
    setActiveId(target.id);
    window.dispatchEvent(new CustomEvent("omega-account-change", { detail: target.id }));
  }, []);

  const activeAccount = CONTAS_DISPONIVEIS.find((c) => c.id === activeId) || CONTA_MATRIZ;
  const isSubconta = activeAccount.id !== "matriz";

  return {
    activeAccount,
    isSubconta,
    switchAccount,
    accounts: CONTAS_DISPONIVEIS,
    matrizAccount: CONTA_MATRIZ,
    subcontaMvp: SUBCONTA_MVP,
  };
}

