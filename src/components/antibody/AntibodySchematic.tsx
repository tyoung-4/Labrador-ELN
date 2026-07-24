"use client";

import { ANNOTATION_TYPES } from "@/config/antibodyRegions";

// ─── Types ───────────────────────────────────────────────────────────────────
// Lightweight prop shapes (not the full Prisma rows) so mock data and partial
// records both satisfy them. Prompt 2 of 4 — schematic only, mock data.

export type RegionSelection = {
  chain: "HEAVY_A" | "HEAVY_B" | "LIGHT_A" | "LIGHT_B";
  region: string;
};

export type SchematicAnnotation = {
  id: string;
  type: string;
  chain: string;
  region: string;
  position?: number | null;
  wtResidue?: string | null;
  mutResidue?: string | null;
  isNonCanonical?: boolean;
  ncaaIdentity?: string | null;
  glycoAction?: string | null;
  tagIdentity?: string | null;
};

export type SchematicBinder = {
  id: string;
  type: string;
  name: string;
  attachPoint?: string | null;
};

type AntibodySchematicProps = {
  isSymmetric: boolean;
  annotations: SchematicAnnotation[];
  binders: SchematicBinder[];
  selectedRegion: RegionSelection | null;
  onRegionClick: (selection: RegionSelection) => void;
};

type Chain = RegionSelection["chain"];

type DomainShape = {
  chain: Chain;
  region: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  label: string;
};

const typeColor = (type: string): string =>
  (ANNOTATION_TYPES as Record<string, { color: string }>)[type]?.color ?? "rgba(255,255,255,0.4)";

// In symmetric antibodies chain B mirrors chain A (A is canonical): annotations,
// selection, and clicks all resolve to the A chain.
const canonChain = (chain: string, isSymmetric: boolean): string =>
  isSymmetric ? chain.replace("_B", "_A") : chain;

// ─── Domain layout (viewBox 0 0 600 700) — upright (untilted) domains ─────────
const W = 54;
const c = (cx: number, cy: number) => ({ x: cx - W / 2, y: cy - W / 2 });

// Left Fab arm = chain A. Upright boxes: VL|VH on top, CL|CH1 below. The heavy
// chain (VH, CH1) is inner (toward the Fc); the light chain (VL, CL) is outer.
const LEFT_FAB: DomainShape[] = [
  { chain: "LIGHT_A", region: "VL",  ...c(160, 120), width: W, height: W, label: "VL" },
  { chain: "HEAVY_A", region: "VH",  ...c(214, 120), width: W, height: W, label: "VH" },
  { chain: "LIGHT_A", region: "CL",  ...c(160, 216), width: W, height: W, label: "CL" },
  { chain: "HEAVY_A", region: "CH1", ...c(214, 216), width: W, height: W, label: "CH1" },
];

// Right Fab arm = chain B, mirror across x=300 (heavy inner on the left side).
const RIGHT_FAB: DomainShape[] = [
  { chain: "HEAVY_B", region: "VH",  ...c(386, 120), width: W, height: W, label: "VH" },
  { chain: "LIGHT_B", region: "VL",  ...c(440, 120), width: W, height: W, label: "VL" },
  { chain: "HEAVY_B", region: "CH1", ...c(386, 216), width: W, height: W, label: "CH1" },
  { chain: "LIGHT_B", region: "CL",  ...c(440, 216), width: W, height: W, label: "CL" },
];

// Fc stem — both heavy chains side by side, centered below the arms.
const FC: DomainShape[] = [
  { chain: "HEAVY_A", region: "CH2", ...c(273, 430), width: W, height: W, label: "CH2" },
  { chain: "HEAVY_B", region: "CH2", ...c(327, 430), width: W, height: W, label: "CH2" },
  { chain: "HEAVY_A", region: "CH3", ...c(273, 500), width: W, height: W, label: "CH3" },
  { chain: "HEAVY_B", region: "CH3", ...c(327, 500), width: W, height: W, label: "CH3" },
];

// CDR loops render as three ovals above each variable domain (cx = domain centre).
const CDR_ANCHORS: { chain: Chain; region: "VH" | "VL"; cx: number; topY: number }[] = [
  { chain: "HEAVY_A", region: "VH", cx: 214, topY: 74 },
  { chain: "LIGHT_A", region: "VL", cx: 160, topY: 74 },
  { chain: "HEAVY_B", region: "VH", cx: 386, topY: 74 },
  { chain: "LIGHT_B", region: "VL", cx: 440, topY: 74 },
];

// N-termini at variable-domain tops (outer corner); C-termini at the CL base
// (light chains) and CH3 base (heavy chains).
const N_TERMINI: { chain: Chain; x: number; y: number }[] = [
  { chain: "LIGHT_A", x: 126, y: 100 },
  { chain: "HEAVY_A", x: 248, y: 100 },
  { chain: "HEAVY_B", x: 352, y: 100 },
  { chain: "LIGHT_B", x: 474, y: 100 },
];
const C_TERMINI: { chain: Chain; x: number; y: number }[] = [
  { chain: "LIGHT_A", x: 126, y: 250 },
  { chain: "LIGHT_B", x: 474, y: 250 },
  { chain: "HEAVY_A", x: 273, y: 552 },
  { chain: "HEAVY_B", x: 327, y: 552 },
];

// ─── Domain rect ─────────────────────────────────────────────────────────────
function DomainRect({
  domain, annotations, isSelected, onClick,
}: {
  domain: DomainShape;
  annotations: SchematicAnnotation[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const domainAnnotations = annotations.filter((a) => a.region === domain.region);
  const hasAnnotations = domainAnnotations.length > 0;
  const annotationColors = [...new Set(domainAnnotations.map((a) => typeColor(a.type)))];

  const cx = domain.x + domain.width / 2;
  const cy = domain.y + domain.height / 2;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      transform={domain.rotation ? `rotate(${domain.rotation} ${cx} ${cy})` : undefined}
    >
      <rect
        x={domain.x} y={domain.y} width={domain.width} height={domain.height} rx={8}
        fill={isSelected ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}
        stroke={isSelected ? "#8b5cf6" : hasAnnotations ? annotationColors[0] : "rgba(255,255,255,0.15)"}
        strokeWidth={isSelected ? 2.5 : hasAnnotations ? 2 : 1}
        className="transition-all"
      />
      <text
        x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.8)" fontSize={12} fontWeight={500}
        style={{ pointerEvents: "none" }}
      >
        {domain.label}
      </text>

      {hasAnnotations && (
        <g style={{ pointerEvents: "none" }}>
          <circle cx={domain.x + domain.width - 6} cy={domain.y + 6} r={9} fill={annotationColors[0]} />
          <text
            x={domain.x + domain.width - 6} y={domain.y + 6}
            textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight={700}
          >
            {domainAnnotations.length}
          </text>
          {annotationColors.length > 1 &&
            annotationColors.slice(1, 4).map((col, i) => (
              <circle key={i} cx={domain.x + domain.width - 6 - (i + 1) * 5} cy={domain.y + 16} r={2.5} fill={col} />
            ))}
        </g>
      )}
    </g>
  );
}

// ─── CDR loops — three ovals above each variable domain ──────────────────────
function CDRArcs({
  chain, region, annotations, selectedRegion, onClick, cx, topY,
}: {
  chain: Chain;
  region: "VH" | "VL";
  annotations: SchematicAnnotation[];
  selectedRegion: RegionSelection | null;
  onClick: (sel: { chain: Chain; region: string }) => void;
  cx: number;
  topY: number;
}) {
  const cdrRegions = region === "VH" ? ["CDR_H1", "CDR_H2", "CDR_H3"] : ["CDR_L1", "CDR_L2", "CDR_L3"];
  return (
    <>
      {cdrRegions.map((cdr, i) => {
        const cdrAnn = annotations.filter((a) => a.region === cdr);
        const has = cdrAnn.length > 0;
        const selected = selectedRegion?.region === cdr;
        const ex = cx + (i - 1) * 15; // three ovals centred on the domain
        const color = selected ? "#8b5cf6" : has ? typeColor(cdrAnn[0].type) : "rgba(255,255,255,0.4)";
        return (
          <ellipse
            key={cdr}
            cx={ex} cy={topY} rx={7} ry={13}
            fill={has ? typeColor(cdrAnn[0].type) + "33" : "transparent"}
            stroke={color}
            strokeWidth={selected || has ? 2.5 : 1.5}
            onClick={(e) => { e.stopPropagation(); onClick({ chain, region: cdr }); }}
            style={{ cursor: "pointer" }}
          />
        );
      })}
    </>
  );
}

// ─── Terminus marker ─────────────────────────────────────────────────────────
function TerminusMarker({
  chain, terminus, annotations, selectedRegion, onClick, x, y,
}: {
  chain: Chain;
  terminus: "N_TERM" | "C_TERM";
  annotations: SchematicAnnotation[];
  selectedRegion: RegionSelection | null;
  onClick: (sel: { chain: Chain; region: string }) => void;
  x: number;
  y: number;
}) {
  const termAnn = annotations.filter((a) => a.region === terminus);
  const hasTag = termAnn.length > 0;
  const selected = selectedRegion?.region === terminus;
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick({ chain, region: terminus }); }} style={{ cursor: "pointer" }}>
      <circle
        cx={x} cy={y} r={7}
        fill={hasTag ? typeColor("TAG") : "rgba(255,255,255,0.1)"}
        stroke={selected ? "#8b5cf6" : "rgba(255,255,255,0.3)"}
        strokeWidth={selected ? 2 : 1}
      />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={8} fontWeight={700} style={{ pointerEvents: "none" }}>
        {terminus === "N_TERM" ? "N" : "C"}
      </text>
      {hasTag && termAnn[0].tagIdentity && (
        <text x={x} y={y - 14} textAnchor="middle" fill={typeColor("TAG")} fontSize={9} style={{ pointerEvents: "none" }}>
          {termAnn[0].tagIdentity}
        </text>
      )}
    </g>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AntibodySchematic({
  isSymmetric, annotations, binders, selectedRegion, onRegionClick,
}: AntibodySchematicProps) {
  // Annotations that apply to a given rendered chain (mirrored from A when symmetric).
  const annForChain = (chain: Chain) =>
    annotations.filter((a) => canonChain(a.chain, isSymmetric) === canonChain(chain, isSymmetric));

  const isSel = (domain: { chain: Chain; region: string }) =>
    !!selectedRegion &&
    canonChain(selectedRegion.chain, isSymmetric) === canonChain(domain.chain, isSymmetric) &&
    selectedRegion.region === domain.region;

  const handleClick = (sel: { chain: Chain; region: string }) =>
    onRegionClick({ chain: canonChain(sel.chain, isSymmetric) as Chain, region: sel.region });

  const allDomains = [...LEFT_FAB, ...RIGHT_FAB, ...FC];

  return (
    <div>
      <svg viewBox="0 0 600 700" className="w-full" role="img" aria-label="Antibody domain schematic">
        {/* Mode indicator */}
        <text x={20} y={30} fill="rgba(255,255,255,0.5)" fontSize={11}>
          {isSymmetric ? "◯ Symmetric" : "◑ Asymmetric"}
        </text>

        {/* ── Connectors ── */}
        <g fill="none" strokeLinecap="round">
          {/* Intra-chain backbone links — stacked domains within one chain are
              joined: VL–CL & VH–CH1 in each Fab arm, CH2–CH3 in each heavy chain. */}
          <g stroke="rgba(96,165,250,0.6)" strokeWidth={2.5}>
            <path d="M 160 147 L 160 189" />
            <path d="M 214 147 L 214 189" />
            <path d="M 386 147 L 386 189" />
            <path d="M 440 147 L 440 189" />
            <path d="M 273 457 L 273 473" />
            <path d="M 327 457 L 327 473" />
          </g>
          {/* Hinge — each heavy chain's CH1 links to ITS OWN CH2 (two separate
              links, not a single convergence). Light chains stop at the Fab. */}
          <g stroke="rgba(255,255,255,0.3)" strokeWidth={2}>
            <path d="M 214 243 L 273 403" />
            <path d="M 386 243 L 327 403" />
          </g>
          {/* Inter-heavy Fc seam — the two heavy chains pair down the Fc. */}
          <path d="M 300 403 L 300 527" stroke="rgba(255,255,255,0.14)" strokeWidth={2} strokeDasharray="3 4" />
        </g>
        {/* Inter-heavy hinge disulfide accent */}
        <path d="M 292 394 L 308 402 M 292 402 L 308 394" stroke={typeColor("DISULFIDE")} strokeWidth={1.5} opacity={0.55} />

        {/* ── CDR loops (three ovals above each variable domain) ── */}
        {CDR_ANCHORS.map((a) => (
          <CDRArcs
            key={`${a.chain}-${a.region}`}
            chain={a.chain}
            region={a.region}
            annotations={annForChain(a.chain)}
            selectedRegion={selectedRegion}
            onClick={handleClick}
            cx={a.cx}
            topY={a.topY}
          />
        ))}

        {/* ── Domains ── */}
        {allDomains.map((d, i) => (
          <DomainRect
            key={`${d.chain}-${d.region}-${i}`}
            domain={d}
            annotations={annForChain(d.chain)}
            isSelected={isSel(d)}
            onClick={() => handleClick(d)}
          />
        ))}

        {/* ── Termini ── */}
        {N_TERMINI.map((t) => (
          <TerminusMarker
            key={`N-${t.chain}`} chain={t.chain} terminus="N_TERM"
            annotations={annForChain(t.chain)} selectedRegion={selectedRegion}
            onClick={handleClick} x={t.x} y={t.y}
          />
        ))}
        {C_TERMINI.map((t) => (
          <TerminusMarker
            key={`C-${t.chain}`} chain={t.chain} terminus="C_TERM"
            annotations={annForChain(t.chain)} selectedRegion={selectedRegion}
            onClick={handleClick} x={t.x} y={t.y}
          />
        ))}

        {/* ── Binders ── */}
        {binders.length > 0 && (
          <g>
            {binders.map((binder, i) => (
              <g key={binder.id}>
                <line
                  x1={468} y1={315 + i * 66} x2={444} y2={315 + i * 66}
                  stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3 3"
                />
                <rect
                  x={468} y={290 + i * 66} width={112} height={50} rx={12}
                  fill="rgba(236,72,153,0.15)" stroke="#ec4899" strokeWidth={2} strokeDasharray="4 2"
                />
                <text x={524} y={310 + i * 66} textAnchor="middle" fill="#ec4899" fontSize={11} fontWeight={600}>
                  {binder.type === "MEDITOPE" ? "Meditope" : binder.type === "FCR_BINDER" ? "FcR Binder" : "Binder"}
                </text>
                <text x={524} y={325 + i * 66} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9}>
                  {binder.name}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {Object.entries(ANNOTATION_TYPES).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="text-xs text-gray-400">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
