import { useEffect, useId, useRef, cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

/** Pitwall-native controls: no second visual system. */
export function PwButton({ tone = "outline", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "outline" | "ghost" | "icon" }) {
  return <button {...props} className={`btn btn-${tone} ${tone === "icon" ? "" : "btn-sm"} ${className}`}>{children}</button>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement<{ id?: string; 'aria-label'?: string }>(children) ? cloneElement(children, { id, 'aria-label': label }) : children;
  return <label className="om-field" htmlFor={id}><span>{label}</span>{control}</label>;
}
export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="om-check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>;
}
export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const id = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", handle);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = document.getElementById(id);
    panel?.querySelector<HTMLElement>("input, button, select, textarea")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]') ?? []);
      const first = list[0]; const last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    panel?.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", handle); panel?.removeEventListener("keydown", trap); previous?.focus(); };
  }, [id]);
  return <div className="pw-modal"><div className="pw-modal-scrim" onClick={close} /><section id={id} className="card pw-modal-panel om-stack" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}><div className="om-between"><h2 id={`${id}-title`} className="t-h3">{title}</h2><PwButton tone="icon" aria-label="Fechar" onClick={close}><X /></PwButton></div>{children}</section></div>;
}
export function Metrics({ items }: { items: { label: string; value: string | number; sub?: string; warning?: boolean }[] }) {
  return <div className="om-metrics">{items.map(i => <div key={i.label} className={`tile om-metric ${i.warning ? "om-warning" : ""}`}><span className="t-meta">{i.label}</span><strong className="num">{i.value}</strong>{i.sub && <small className="t-caption">{i.sub}</small>}</div>)}</div>;
}
export function Empty({ children = "Nenhum registro neste filtro." }: { children?: ReactNode }) { return <p className="om-empty t-caption">{children}</p>; }