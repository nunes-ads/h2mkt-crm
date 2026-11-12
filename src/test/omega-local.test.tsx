import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearRuntimeState, useLocalDemo, useRuntimeState } from "@/lib/omega-local";

beforeEach(() => {
  localStorage.clear();
  clearRuntimeState();
});
describe("Caches por chave e sessão", () => {
  it("trocar de conta não copia nem persiste o estado anterior", () => {
    localStorage.setItem("a", JSON.stringify(["Ana"]));
    localStorage.setItem("b", JSON.stringify(["Bruno"]));
    const { result, rerender } = renderHook(({ id }) => useLocalDemo<string[]>(id, []), {
      initialProps: { id: "a" },
    });
    expect(result.current[0]).toEqual(["Ana"]);
    rerender({ id: "b" });
    expect(result.current[0]).toEqual(["Bruno"]);
    expect(JSON.parse(localStorage.getItem("b")!)).toEqual(["Bruno"]);
    act(() => result.current[1]((old) => [...old, "Bia"]));
    expect(JSON.parse(localStorage.getItem("a")!)).toEqual(["Ana"]);
  });
  it("sincroniza editores da mesma chave sem perder alterações concorrentes", () => {
    const a = renderHook(() => useLocalDemo<number[]>("shared", []));
    const b = renderHook(() => useLocalDemo<number[]>("shared", []));
    act(() => {
      a.result.current[1]([1]);
      b.result.current[1]((old) => [...old, 2]);
    });
    expect(a.result.current[0]).toEqual([1, 2]);
    expect(b.result.current[0]).toEqual([1, 2]);
  });
  it("histórico temporário não vai para localStorage e é limpo no logout", () => {
    const initial: string[] = [];
    const hook = renderHook(({ key }) => useRuntimeState(key, initial), {
      initialProps: { key: "user1:tenant1" },
    });
    act(() => hook.result.current[1](["mensagem"]));
    expect(localStorage.length).toBe(0);
    hook.rerender({ key: "user2:tenant1" });
    expect(hook.result.current[0]).toEqual([]);
    act(() => clearRuntimeState());
    hook.rerender({ key: "user1:tenant1" });
    expect(hook.result.current[0]).toEqual([]);
  });
});
