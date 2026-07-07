"use client";

import { useMemo, useRef, useState } from "react";

type Point = { date: string; totalCents: number };

// Net-worth area chart: single series (no legend needed), hairline grid,
// crosshair + tooltip hover layer per the dataviz interaction spec.
export function NetWorthChart({ points, currencySymbol }: { points: Point[]; currencySymbol: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 720;
  const H = 220;
  const PAD = { l: 8, r: 8, t: 12, b: 22 };

  const { path, area, xs, ys, min, max } = useMemo(() => {
    if (points.length < 2) {
      return { path: "", area: "", xs: [] as number[], ys: [] as number[], min: 0, max: 0 };
    }
    const values = points.map((p) => p.totalCents / 100);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || Math.abs(hi) || 1;
    const min = lo - span * 0.08;
    const max = hi + span * 0.08;
    const xs = points.map((_, i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(points.length - 1, 1));
    const ys = values.map((v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b));
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    const area = `${path} L${xs[xs.length - 1].toFixed(1)},${H - PAD.b} L${xs[0].toFixed(1)},${H - PAD.b} Z`;
    return { path, area, xs, ys, min, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="h-[220px] grid place-items-center text-sm" style={{ color: "var(--ink-3)" }}>
        Record balances on more than one day and your net-worth history will draw here.
      </div>
    );
  }

  const fmt = (cents: number) => {
    const whole = Math.trunc(cents / 100);
    return `${cents < 0 ? "-" : ""}${currencySymbol}${Math.abs(whole).toLocaleString("en-US")}`;
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    setHover(best);
  }

  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD.t + f * (H - PAD.t - PAD.b));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block touch-none"
        role="img"
        aria-label={`Net worth over time, from ${fmt(points[0].totalCents)} on ${points[0].date} to ${fmt(points[points.length - 1].totalCents)} on ${points[points.length - 1].date}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridYs.map((y) => (
          <line key={y} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1" />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--baseline)" strokeWidth="1" />
        <path d={area} fill="var(--area-fill)" />
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* first/last date labels */}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--ink-3)">
          {points[0].date}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--ink-3)" textAnchor="end">
          {points[points.length - 1].date}
        </text>
        {/* min/max value labels */}
        <text x={W - PAD.r} y={PAD.t + 4} fontSize="10" fill="var(--ink-3)" textAnchor="end">
          {fmt(Math.round(max * 100))}
        </text>
        <text x={W - PAD.r} y={H - PAD.b - 4} fontSize="10" fill="var(--ink-3)" textAnchor="end">
          {fmt(Math.round(min * 100))}
        </text>
        {hover !== null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={H - PAD.b} stroke="var(--baseline)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={xs[hover]} cy={ys[hover]} r="4.5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="absolute pointer-events-none card px-3 py-1.5 text-xs shadow-lg"
          style={{ left: `${(xs[hover] / W) * 100}%`, top: 0, transform: `translateX(${hover > points.length / 2 ? "-110%" : "10%"})` }}
        >
          <div style={{ color: "var(--ink-3)" }}>{points[hover].date}</div>
          <div className="font-bold tnum">{fmt(points[hover].totalCents)}</div>
        </div>
      )}
    </div>
  );
}
