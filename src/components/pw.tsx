import type { ReactNode } from "react";

/** Metadados de rota padronizados. */
export function meta(title: string, description: string) {
  const t = `${title} · CRM Grupo Ômega`;
  return {
    meta: [
      { title: t },
      { name: "description", content: description },
      { property: "og:title", content: t },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

/** Cabeçalho de página: boot + .t-accent na última palavra (se houver mais de uma). */
export function PageHead({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}) {
  const words = title.split(" ");
  const last = words.length > 1 ? words.pop() : null;
  return (
    <div className="hero-row">
      <div className="stack" style={{ gap: 6 }}>
        <span className="t-eyebrow boot-eyebrow">{eyebrow}</span>
        <h1 className="t-h1 boot-title is-in">
          {last ? (
            <>
              {words.join(" ")} <span className="t-accent">{last}</span>
            </>
          ) : (
            title
          )}
        </h1>
      </div>
      {actions && <div className="hstack">{actions}</div>}
    </div>
  );
}

export function Corners() {
  return (
    <>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
    </>
  );
}

export function Spark({ pts }: { pts: number[] }) {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 100, 40 - ((v - min) / (max - min || 1)) * 34]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x!.toFixed(1)} ${y!.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1]!;
  return (
    <svg className="spark" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
      <path className="line" d={d} vectorEffect="non-scaling-stroke" />
      <circle className="dot" cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  unit,
  delta,
  dir = "up",
  amber,
  pts,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  dir?: "up" | "down" | "flat";
  amber?: boolean;
  pts: number[];
}) {
  return (
    <div className={`card tile kpi hud glow-card reveal ${amber ? "is-amber" : ""}`} data-signal={amber ? "true" : undefined}>
      <Corners />
      <div className="kpi-top">
        <span className={`t-eyebrow ${amber ? "is-amber" : ""}`}>{label}</span>
        <span className={`delta ${dir}`}>{delta}</span>
      </div>
      <div className="t-metric num">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <Spark pts={pts} />
    </div>
  );
}

export function Card({
  title,
  sub,
  actions,
  className = "",
  children,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card reveal ${className}`}>
      <div className="card-head">
        <div>
          <h2 className="t-h3 wipe">
            <span className="wipe-text">{title}</span>
            <span className="wipe-block" aria-hidden="true" />
          </h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? "is-active" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

export function Money({ v }: { v: number }) {
  return <span className="pw-money">{brl(v)}</span>;
}
