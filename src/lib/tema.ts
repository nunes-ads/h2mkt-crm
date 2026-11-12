// Tema Pitwall: dark é o padrão; "light" força o claro. Guarda a escolha em localStorage.
const CHAVE = "omega-tema";
export type Tema = "dark" | "light";
export function temaAtual(): Tema {
  try {
    return (localStorage.getItem(CHAVE) as Tema) || "dark";
  } catch {
    return "dark";
  }
}
export function aplicarTema(t: Tema) {
  const html = document.documentElement;
  html.dataset["theme"] = t;
  html.classList.toggle("dark", t === "dark");
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* sem storage */
  }
}
export function alternarTema(): Tema {
  const prox: Tema = temaAtual() === "dark" ? "light" : "dark";
  aplicarTema(prox);
  return prox;
}
