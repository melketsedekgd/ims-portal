"use client";

import { Button } from "@/components/ui/button";

const COLORS = {
  text: "#242C3F",
  amber: "#FF7352",
} as const;

interface NavProps {
  onLoginClick?: () => void;
}

const C_DOTS: { cx: number; cy: number; r: number }[] = [
  { cx: 209.0, cy: 21.4, r: 2.82 },
  { cx: 199.3, cy: 22.0, r: 2.76 },
  { cx: 217.3, cy: 24.0, r: 2.76 },
  { cx: 191.0, cy: 24.6, r: 2.82 },
  { cx: 208.3, cy: 27.9, r: 2.26 },
  { cx: 201.5, cy: 28.1, r: 2.19 },
  { cx: 183.6, cy: 30.0, r: 2.82 },
  { cx: 214.5, cy: 30.1, r: 2.19 },
  { cx: 194.5, cy: 30.3, r: 2.11 },
  { cx: 202.0, cy: 34.3, r: 1.49 },
  { cx: 207.0, cy: 34.3, r: 1.49 },
  { cx: 189.0, cy: 34.5, r: 2.26 },
  { cx: 197.3, cy: 36.0, r: 1.49 },
  { cx: 211.7, cy: 36.0, r: 1.49 },
  { cx: 178.3, cy: 37.0, r: 2.76 },
  { cx: 193.1, cy: 38.9, r: 1.6 },
  { cx: 184.8, cy: 39.6, r: 2.11 },
  { cx: 190.1, cy: 42.9, r: 1.6 },
  { cx: 175.3, cy: 45.3, r: 2.88 },
  { cx: 182.5, cy: 46.3, r: 2.11 },
  { cx: 188.9, cy: 47.1, r: 1.6 },
  { cx: 188.9, cy: 52.1, r: 1.6 },
  { cx: 182.5, cy: 53.3, r: 2.11 },
  { cx: 175.4, cy: 54.0, r: 2.82 },
  { cx: 190.3, cy: 57.0, r: 1.49 },
  { cx: 184.9, cy: 59.5, r: 2.19 },
  { cx: 193.3, cy: 61.0, r: 1.49 },
  { cx: 178.2, cy: 62.7, r: 2.82 },
  { cx: 211.9, cy: 63.9, r: 1.6 },
  { cx: 197.3, cy: 64.0, r: 1.49 },
  { cx: 202.0, cy: 65.3, r: 1.49 },
  { cx: 207.0, cy: 65.3, r: 1.49 },
  { cx: 189.1, cy: 65.5, r: 2.19 },
  { cx: 194.7, cy: 69.5, r: 2.11 },
  { cx: 214.7, cy: 69.5, r: 2.11 },
  { cx: 183.6, cy: 70.0, r: 2.82 },
  { cx: 201.3, cy: 71.5, r: 2.11 },
  { cx: 208.3, cy: 71.5, r: 2.11 },
  { cx: 191.0, cy: 75.0, r: 2.59 },
  { cx: 217.5, cy: 75.5, r: 2.76 },
  { cx: 209.4, cy: 77.6, r: 2.82 },
  { cx: 199.5, cy: 77.7, r: 2.88 },
];

function MMCYLogo() {
  return (
    <svg
      width="210"
      height="66"
      viewBox="0 0 300 95"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="MMCY"
    >
      <g
        transform="translate(0,95) scale(0.1,-0.1)"
        fill={COLORS.text}
        stroke="none"
      >
        <path d="M140 450 l0 -280 68 0 67 0 -3 175 c-2 96 1 175 5 175 5 0 42 -78 84 -172 l75 -173 54 -3 55 -2 74 172 c41 95 78 177 83 183 4 5 8 -73 8 -173 l0 -182 65 0 65 0 0 280 0 281 -82 -3 -82 -3 -93 -205 -92 -204 -30 64 c-16 36 -58 128 -93 205 l-64 140 -82 3 -82 3 0 -281z" />

        <path d="M940 450 l0 -280 65 0 65 0 0 182 c0 100 4 178 8 173 5 -6 42 -88 83 -183 l74 -172 55 2 54 3 75 173 c42 94 79 172 83 172 5 0 8 -79 8 -175 l0 -175 65 0 65 0 0 280 0 280 -82 0 -83 0 -90 -201 c-49 -110 -92 -202 -95 -204 -3 -2 -46 88 -97 198 l-92 202 -80 3 -81 3 0 -281z" />

        <path d="M2290 724 c0 -3 45 -86 100 -185 l100 -179 0 -95 0 -95 65 0 65 0 0 95 0 95 95 170 c52 93 98 176 101 185 5 13 -4 15 -57 15 l-64 0 -65 -120 c-36 -66 -68 -120 -72 -120 -4 0 -37 54 -75 120 l-68 120 -62 0 c-35 0 -63 -3 -63 -6z" />
      </g>

      <g fill={COLORS.amber}>
        {C_DOTS.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} />
        ))}
      </g>
    </svg>
  );
}

export default function Nav({ onLoginClick }: NavProps) {
  return (
    <nav
      className="
        fixed inset-x-0 top-0 z-[1000]
        flex items-center justify-between
        box-border
        px-[70px] py-[14px]
        border-b border-[rgba(229,227,222,0.65)]
        bg-[rgba(251,251,249,0.72)]
        shadow-[0_4px_24px_rgba(30,34,48,0.04)]
        backdrop-blur-[18px]
      "
    >
      <MMCYLogo />

      <Button
        type="button"
        onClick={onLoginClick}
        className="
          h-auto
          rounded-[8px]
          border-0
          bg-[#FF7352]
          px-6
          py-2.5
          text-[15px]
          font-semibold
          text-white
          shadow-[0_4px_12px_rgba(36,44,63,0.14)]
          transition-all
          duration-200
          ease-in-out
          hover:-translate-y-px
          hover:bg-[#FF7352]
          hover:shadow-[0_6px_16px_rgba(36,44,63,0.20)]
        "
      >
        Sign in
      </Button>
    </nav>
  );
}