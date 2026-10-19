/** Small, dependency-free SVG charts for the owner dashboard. */

const W = 640;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };

function scale(values: number[]) {
  const max = Math.max(1, ...values);
  const niceMax = max <= 5 ? max : Math.ceil(max / 5) * 5;
  return { max: niceMax, y: (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / niceMax) };
}

function xLabels(days: string[]) {
  if (days.length <= 1) return days.map((d, i) => ({ i, d }));
  const step = Math.max(1, Math.ceil(days.length / 6));
  return days.map((d, i) => ({ i, d })).filter(({ i }) => i % step === 0 || i === days.length - 1);
}

const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

function Frame({ days, max, children, label }: { days: string[]; max: number; children: React.ReactNode; label: string }) {
  const x = (i: number) => PAD.left + ((W - PAD.left - PAD.right) * (days.length <= 1 ? 0.5 : i / (days.length - 1)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      {[0, 0.5, 1].map((f) => {
        const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e1e7ea" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#8b969c">
              {Math.round(max * f)}
            </text>
          </g>
        );
      })}
      {xLabels(days).map(({ i, d }) => (
        <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#8b969c">
          {short(d)}
        </text>
      ))}
      {children}
    </svg>
  );
}

export function LineChart({ days, values, label }: { days: string[]; values: number[]; label: string }) {
  const { max, y } = scale(values);
  const x = (i: number) => PAD.left + ((W - PAD.left - PAD.right) * (days.length <= 1 ? 0.5 : i / (days.length - 1)));
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <Frame days={days} max={max} label={label}>
      <polyline points={points} fill="none" stroke="#121821" strokeWidth={2} strokeLinejoin="round" />
      {values.length <= 31 && values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="#121821" />)}
    </Frame>
  );
}

export function BarChart({ days, values, label }: { days: string[]; values: number[]; label: string }) {
  const { max, y } = scale(values);
  const slot = (W - PAD.left - PAD.right) / Math.max(1, values.length);
  return (
    <Frame days={days} max={max} label={label}>
      {values.map((v, i) => {
        const top = y(v);
        return (
          <rect
            key={i}
            x={PAD.left + slot * i + slot * 0.15}
            y={top}
            width={Math.max(1, slot * 0.7)}
            height={H - PAD.bottom - top}
            fill={v > 0 ? "#4f5b66" : "transparent"}
          >
            <title>{`${days[i]}: ${v}`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}

/** Horizontal bars for comparing features; the longest bar is 100%. */
export function HBars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[12.5px]">
          <span className="text-[#3b4850]">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-[#eef2f3]">
            <span className="block h-full rounded-full bg-[#121821]" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-[#121821]">
            {r.value}
            {r.note && <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-[1px] text-[#a03a2f]">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
