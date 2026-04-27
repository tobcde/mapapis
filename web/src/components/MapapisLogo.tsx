/* eslint-disable react-refresh/only-export-components */
/**
 * MapapisLogo — V6 "hoja escolar".
 *
 * Variantes:
 *   - lockup   : hoja vertical completa (sol, wordmark, tagline, nubes, familia)
 *   - wordmark : solo "mapapis" con highlighter + pin (para headers)
 *   - mark     : solo el map-pin (icono mínimo)
 *   - favicon  : 32px corner-of-page con pin
 *
 * Paletas: classic | warm | market.
 *
 * Inter 800/900 ya cargado en `web/index.html`.
 */
import type { CSSProperties, ReactElement } from 'react';

type Variant = 'lockup' | 'wordmark' | 'mark' | 'favicon';
type PaletteName = 'classic' | 'warm' | 'market';

const COLORS = {
  ink: '#0E1525',
  cream: '#FFF7EE',
  cream2: '#FBF6EE',
  coral: '#FF5A4E',
  sun: '#FFC83D',
  sage: '#2BC48A',
  violet: '#6E5BFF',
  mist: '#EFE7DA',
  sky: '#9EC9EF',
} as const;

interface Palette {
  paper: string;
  pin: string;
  highlight: string;
}

const PALETTES: Record<PaletteName, Palette> = {
  classic: { paper: COLORS.cream, pin: COLORS.coral, highlight: COLORS.sun },
  warm: { paper: COLORS.cream2, pin: COLORS.coral, highlight: COLORS.sun },
  market: { paper: COLORS.cream, pin: COLORS.sage, highlight: COLORS.sun },
};

const ASPECT: Record<Variant, number> = {
  lockup: 700 / 940,
  wordmark: 600 / 220,
  mark: 100 / 128,
  favicon: 1,
};

const CFG: Record<Variant, { vb: string; dw: number }> = {
  lockup: { vb: '0 0 700 940', dw: 320 },
  wordmark: { vb: '0 0 600 220', dw: 300 },
  mark: { vb: '0 0 100 128', dw: 64 },
  favicon: { vb: '0 0 32 32', dw: 32 },
};

// ── Sub: map-pin ─────────────────────────────────────────────
interface PinPathProps {
  x?: number;
  y?: number;
  scale?: number;
  fill: string;
  stroke?: string;
  sw?: number;
  holeFill: string;
}
function PinPath({
  x = 0,
  y = 0,
  scale = 1,
  fill,
  stroke = COLORS.ink,
  sw = 6,
  holeFill,
}: PinPathProps) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <path
        d="M50 4 C76 4 94 22 94 48 C94 74 64 110 50 124 C36 110 6 74 6 48 C6 22 24 4 50 4 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <circle cx={50} cy={46} r={15} fill={holeFill} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

// ── Sub: wordmark ────────────────────────────────────────────
interface WordmarkSvgProps {
  x: number;
  y: number;
  size: number;
  paper: string;
  pinColor: string;
  color?: string;
}
function WordmarkSvg({ x, y, size, paper, pinColor, color = COLORS.ink }: WordmarkSvgProps) {
  const charW = size * 0.62;
  return (
    <g transform={`translate(${x}, ${y}) rotate(-2.5)`}>
      <rect
        x={-6}
        y={size * 0.3}
        width={size * 4.6}
        height={size * 0.62}
        fill={COLORS.sun}
        opacity={0.78}
        rx={3}
        transform={`skewX(-6) translate(0, ${size * 0.05})`}
      />
      <text
        x={0}
        y={size}
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight={900}
        fontSize={size}
        letterSpacing={-size * 0.045}
        fill={color}
      >
        mapapıs
      </text>
      <PinPath
        x={charW * 4.95}
        y={-size * 0.1}
        scale={size * 0.0033}
        fill={pinColor}
        holeFill={paper}
      />
    </g>
  );
}

// ── Sub: sol ─────────────────────────────────────────────────
function SunSvg({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const sw = Math.max(1.4, size * 0.025);
  return (
    <g
      transform={`translate(${cx - size / 2}, ${cy - size / 2}) rotate(8 ${size / 2} ${size / 2})`}
    >
      <path
        d={`M${size * 0.5} ${size * 0.23} C ${size * 0.63} ${size * 0.23} ${size * 0.73} ${size * 0.3} ${size * 0.75} ${size * 0.43} C ${size * 0.77} ${size * 0.55} ${size * 0.7} ${size * 0.67} ${size * 0.57} ${size * 0.7} C ${size * 0.43} ${size * 0.73} ${size * 0.3} ${size * 0.67} ${size * 0.27} ${size * 0.53} C ${size * 0.23} ${size * 0.38} ${size * 0.35} ${size * 0.23} ${size * 0.5} ${size * 0.23} Z`}
        fill={COLORS.sun}
        stroke={COLORS.ink}
        strokeWidth={sw}
        strokeLinejoin="round"
        opacity={0.92}
      />
      <g
        stroke={COLORS.ink}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
        opacity={0.88}
      >
        <line x1={size * 0.5} y1={size * 0.05} x2={size * 0.5} y2={size * 0.15} />
        <line x1={size * 0.5} y1={size * 0.8} x2={size * 0.5} y2={size * 0.9} />
        <line x1={size * 0.05} y1={size * 0.47} x2={size * 0.15} y2={size * 0.47} />
        <line x1={size * 0.85} y1={size * 0.47} x2={size * 0.95} y2={size * 0.47} />
        <line x1={size * 0.18} y1={size * 0.18} x2={size * 0.25} y2={size * 0.25} />
        <line x1={size * 0.75} y1={size * 0.18} x2={size * 0.82} y2={size * 0.25} />
        <line x1={size * 0.18} y1={size * 0.75} x2={size * 0.25} y2={size * 0.68} />
        <line x1={size * 0.75} y1={size * 0.75} x2={size * 0.82} y2={size * 0.68} />
      </g>
      <path
        d={`M${size * 0.4} ${size * 0.5} Q ${size * 0.5} ${size * 0.58} ${size * 0.6} ${size * 0.5}`}
        fill="none"
        stroke={COLORS.ink}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
      />
    </g>
  );
}

// ── Sub: nubes ───────────────────────────────────────────────
function CloudsSvg({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 0.7;
  const sw = Math.max(1.2, w * 0.012);
  return (
    <g transform={`translate(${x}, ${y}) rotate(-3)`}>
      <svg x={0} y={0} width={w} height={h} viewBox="0 0 200 140" overflow="visible">
        <g transform="translate(0, 8) rotate(-3 50 30)">
          <path
            d="M18 38 Q 12 26 24 22 Q 28 12 42 16 Q 50 6 64 14 Q 78 12 80 26 Q 90 30 84 42 Q 80 50 66 48 Q 54 54 42 48 Q 28 50 22 44 Q 14 44 18 38 Z"
            fill={COLORS.sky}
            stroke={COLORS.ink}
            strokeWidth={sw}
            strokeLinejoin="round"
            opacity={0.85}
          />
          <path
            d="M28 32 Q 36 34 44 32 M 38 40 Q 48 42 58 40 M 52 28 Q 60 30 68 28"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth={sw * 0.55}
            strokeLinecap="round"
            opacity={0.35}
          />
        </g>
        <g transform="translate(110, 0) rotate(4 50 30)">
          <path
            d="M14 32 Q 8 22 20 20 Q 24 10 38 14 Q 50 10 56 22 Q 68 24 64 36 Q 58 44 46 42 Q 32 46 22 40 Q 12 40 14 32 Z"
            fill={COLORS.sky}
            stroke={COLORS.ink}
            strokeWidth={sw}
            strokeLinejoin="round"
            opacity={0.85}
          />
          <path
            d="M22 26 Q 30 28 38 26 M 32 36 Q 42 38 50 36"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth={sw * 0.55}
            strokeLinecap="round"
            opacity={0.35}
          />
        </g>
        <g transform="translate(40, 70) rotate(-2 50 30)">
          <path
            d="M16 36 Q 8 24 22 22 Q 26 10 42 14 Q 56 8 66 22 Q 80 24 76 38 Q 72 48 58 46 Q 44 52 32 46 Q 18 46 16 36 Z"
            fill={COLORS.sky}
            stroke={COLORS.ink}
            strokeWidth={sw}
            strokeLinejoin="round"
            opacity={0.85}
          />
          <path
            d="M26 30 Q 36 32 46 30 M 38 40 Q 50 42 60 40"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth={sw * 0.55}
            strokeLinecap="round"
            opacity={0.35}
          />
        </g>
      </svg>
    </g>
  );
}

// ── Sub: familia ─────────────────────────────────────────────
interface FamilySvgProps {
  x: number;
  y: number;
  w: number;
  paper: string;
  accent: string;
}
function FamilySvg({ x, y, w, paper, accent }: FamilySvgProps) {
  const h = w * 0.55;
  const sw = Math.max(1.6, w * 0.014);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <svg x={0} y={0} width={w} height={h} viewBox="0 0 200 110" overflow="visible">
        <g
          stroke={COLORS.ink}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {/* papá */}
          <circle cx={32} cy={20} r={9} fill={paper} />
          <line x1={32} y1={29} x2={32} y2={66} />
          <line x1={32} y1={40} x2={20} y2={50} />
          <line x1={32} y1={40} x2={44} y2={50} />
          <line x1={32} y1={66} x2={24} y2={88} />
          <line x1={32} y1={66} x2={40} y2={88} />
          {/* mamá */}
          <circle cx={70} cy={26} r={9} fill={paper} />
          <path d="M61 22 Q 65 14 70 16 Q 76 14 79 22" />
          <line x1={70} y1={35} x2={70} y2={66} />
          <line x1={70} y1={44} x2={58} y2={54} />
          <line x1={70} y1={44} x2={82} y2={54} />
          <path d="M70 60 L60 88 L80 88 Z" />
          {/* nene */}
          <circle cx={108} cy={38} r={7} fill={paper} />
          <line x1={108} y1={45} x2={108} y2={70} />
          <line x1={108} y1={52} x2={100} y2={60} />
          <line x1={108} y1={52} x2={116} y2={60} />
          <line x1={108} y1={70} x2={102} y2={88} />
          <line x1={108} y1={70} x2={114} y2={88} />
          {/* bebé */}
          <circle cx={138} cy={48} r={6} fill={paper} />
          <line x1={138} y1={54} x2={138} y2={72} />
          <line x1={138} y1={60} x2={132} y2={66} />
          <line x1={138} y1={60} x2={144} y2={66} />
          <line x1={138} y1={72} x2={134} y2={88} />
          <line x1={138} y1={72} x2={142} y2={88} />
          {/* perrito */}
          <ellipse cx={172} cy={78} rx={14} ry={7} fill={paper} />
          <circle cx={186} cy={72} r={6} fill={paper} />
          <path d="M188 67 L 192 60 L 184 64 Z" fill={paper} />
          <line x1={163} y1={84} x2={161} y2={92} />
          <line x1={170} y1={84} x2={168} y2={92} />
          <line x1={177} y1={84} x2={179} y2={92} />
          <line x1={184} y1={82} x2={186} y2={90} />
          <path d="M158 76 Q 152 70 156 64" />
          <circle cx={188} cy={71} r={0.8} fill={COLORS.ink} />
        </g>
        {/* corazón */}
        <path
          d="M52 18 Q 50 14 47 17 Q 45 20 52 25 Q 59 20 57 17 Q 54 14 52 18 Z"
          fill={accent}
          stroke={COLORS.ink}
          strokeWidth={sw * 0.8}
          strokeLinejoin="round"
        />
        {/* piso */}
        <path
          d="M14 96 Q 60 92 110 96 T 196 95"
          stroke={COLORS.ink}
          strokeWidth={sw * 0.9}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      </svg>
    </g>
  );
}

// ── LOCKUP ───────────────────────────────────────────────────
function LockupSvg({ palette }: { palette: Palette }) {
  const W = 700;
  const H = 940;
  const ringCount = 13;
  const ringStartY = 50;
  const ringEndY = H - 50;

  const ruleLines: ReactElement[] = [];
  for (let y = 90; y < H - 50; y += 50) {
    ruleLines.push(
      <line
        key={y}
        x1={60}
        y1={y}
        x2={W - 32}
        y2={y}
        stroke={COLORS.ink}
        strokeWidth={1.6}
        opacity={0.18}
      />
    );
  }
  const holes: ReactElement[] = [];
  for (let i = 0; i < ringCount; i++) {
    const cy = ringStartY + i * ((ringEndY - ringStartY) / (ringCount - 1));
    holes.push(
      <ellipse key={i} cx={22} cy={cy} rx={10} ry={6} fill={COLORS.ink} opacity={0.85} />
    );
  }

  return (
    <>
      <rect x={13} y={13} width={W - 16} height={H - 16} rx={10} fill={COLORS.ink} />
      <rect
        x={3}
        y={3}
        width={W - 16}
        height={H - 16}
        rx={10}
        fill={palette.paper}
        stroke={COLORS.ink}
        strokeWidth={5}
      />
      {ruleLines}
      <line
        x1={92}
        y1={30}
        x2={92}
        y2={H - 30}
        stroke={COLORS.coral}
        strokeWidth={3}
        opacity={0.6}
      />
      {holes}
      <SunSvg cx={W - 100} cy={110} size={130} />
      <WordmarkSvg
        x={120}
        y={260}
        size={104}
        paper={palette.paper}
        pinColor={palette.pin}
      />
      <g transform="translate(120, 470)">
        <text
          x={0}
          y={0}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={800}
          fontSize={34}
          fill={COLORS.ink}
          opacity={0.9}
          transform="rotate(-1.5)"
        >
          Solución para las
        </text>
        <text
          x={0}
          y={48}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={800}
          fontSize={34}
          fill={COLORS.ink}
          opacity={0.9}
          transform="rotate(-1)"
        >
          Familias y PYMES.
        </text>
        <text
          x={0}
          y={120}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={900}
          fontSize={36}
          fill={COLORS.ink}
          opacity={0.9}
          transform="rotate(2)"
        >
          Todos ganan.
        </text>
      </g>
      <CloudsSvg x={420} y={440} w={220} />
      {/* familia abajo — más arriba, y más angosta para que entre el perro completo */}
      <FamilySvg x={110} y={700} w={460} paper={palette.paper} accent={palette.pin} />
    </>
  );
}

function WordmarkOnlySvg({ palette }: { palette: Palette }) {
  return (
    <WordmarkSvg x={40} y={90} size={96} paper={palette.paper} pinColor={palette.pin} />
  );
}

function MarkSvg({ palette }: { palette: Palette }) {
  return <PinPath x={3} y={2} scale={1} fill={palette.pin} holeFill={palette.paper} sw={6} />;
}

function FaviconSvg({ palette }: { palette: Palette }) {
  return (
    <>
      <rect
        x={2}
        y={2}
        width={28}
        height={28}
        rx={3}
        fill={palette.paper}
        stroke={COLORS.ink}
        strokeWidth={2}
      />
      <line
        x1={7}
        y1={3}
        x2={7}
        y2={29}
        stroke={COLORS.coral}
        strokeWidth={1}
        opacity={0.6}
      />
      <PinPath x={11} y={8} scale={0.1} fill={palette.pin} holeFill={palette.paper} sw={10} />
    </>
  );
}

// ── Componente principal ─────────────────────────────────────
export interface MapapisLogoProps {
  variant?: Variant;
  palette?: PaletteName;
  width?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function MapapisLogo({
  variant = 'lockup',
  palette = 'classic',
  width,
  title = 'MaPaPis',
  className,
  style,
}: MapapisLogoProps) {
  const p = PALETTES[palette];
  const ar = ASPECT[variant];
  const cfg = CFG[variant];
  const w = width ?? cfg.dw;
  const h = w / ar;

  let body: ReactElement;
  switch (variant) {
    case 'wordmark':
      body = <WordmarkOnlySvg palette={p} />;
      break;
    case 'mark':
      body = <MarkSvg palette={p} />;
      break;
    case 'favicon':
      body = <FaviconSvg palette={p} />;
      break;
    case 'lockup':
    default:
      body = <LockupSvg palette={p} />;
      break;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={cfg.vb}
      width={w}
      height={h}
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <title>{title}</title>
      {body}
    </svg>
  );
}

export const mapapisColors = COLORS;
export const mapapisPalettes = PALETTES;
