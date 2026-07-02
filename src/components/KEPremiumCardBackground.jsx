import "./KEPremiumCardBackground.css";

const WAVE_LINES = Array.from({ length: 38 }, (_, i) => i);
const GOLD_DOTS = Array.from({ length: 132 }, (_, i) => i);

export default function KEPremiumCardBackground({
  children,
  className = "",
  rounded = true,
}) {
  return (
    <section
      className={[
        "ke-premium-card-bg",
        rounded ? "ke-premium-card-bg--rounded" : "",
        className,
      ].join(" ")}
    >
      <div className="ke-premium-card-bg__glow" />
      <div className="ke-premium-card-bg__shine" />

      <svg
        className="ke-premium-card-bg__svg"
        viewBox="0 0 1536 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="kePanelBlueLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0b54bd" stopOpacity="0.03" />
            <stop offset="42%" stopColor="#297cff" stopOpacity="0.23" />
            <stop offset="70%" stopColor="#2d86ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1b62d7" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="kePanelGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5e3b00" stopOpacity="0" />
            <stop offset="25%" stopColor="#ba8210" />
            <stop offset="58%" stopColor="#ffe45f" />
            <stop offset="82%" stopColor="#bf8211" />
            <stop offset="100%" stopColor="#7d5104" />
          </linearGradient>

          <linearGradient id="kePanelGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1d76ff" stopOpacity="0.03" />
            <stop offset="42%" stopColor="#277eff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#032058" stopOpacity="0.03" />
          </linearGradient>

          <filter id="keGoldBlur" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <path d="M 135 -80 L -95 210" stroke="#2a73e5" strokeOpacity="0.055" strokeWidth="1" />
        <path d="M 235 -80 L -20 300" stroke="#2a73e5" strokeOpacity="0.045" strokeWidth="1" />
        <path d="M 315 -80 L 68 345" stroke="#2a73e5" strokeOpacity="0.035" strokeWidth="1" />

        {WAVE_LINES.map((_, i) => {
          const t = i / (WAVE_LINES.length - 1);
          const y0 = 335 + i * 7.15;
          const c1y = 305 + i * 1.1;
          const c2y = 600 - i * 3.25;
          const y1 = 475 - i * 2.05;
          const opacity = 0.1 + t * 0.25;

          return (
            <path
              key={`wave-${i}`}
              d={`
                M -90 ${y0.toFixed(1)}
                C 142 ${c1y.toFixed(1)}, 290 ${c1y.toFixed(1)}, 490 ${y1.toFixed(1)}
                C 690 ${(c2y - 26).toFixed(1)}, 878 ${(c2y - 74).toFixed(1)}, 1240 ${(y1 + 5).toFixed(1)}
              `}
              fill="none"
              stroke="url(#kePanelBlueLine)"
              strokeWidth={0.72 + t * 0.26}
              opacity={opacity}
            />
          );
        })}

        <path d="M 1275 170 L 1536 0 L 1536 720 L 975 720 Z" fill="url(#kePanelGlass)" opacity="0.48" />
        <path d="M 1398 185 L 1536 86 L 1536 720 L 1115 720 Z" fill="url(#kePanelGlass)" opacity="0.42" />
        <path d="M 1490 238 L 1536 200 L 1536 720 L 1288 720 Z" fill="#0d3d92" opacity="0.12" />

        <path d="M 1532 205 L 1185 720" stroke="#2c7fff" strokeOpacity="0.07" strokeWidth="1" />
        <path d="M 1452 250 L 1092 720" stroke="#2c7fff" strokeOpacity="0.07" strokeWidth="1" />

        {GOLD_DOTS.map((_, i) => {
          const col = i % 12;
          const row = Math.floor(i / 12);
          const x = 1308 + col * 15.2;
          const y = 355 + row * 15.3;
          const rowFade = 1 - row / 12;
          const colFade = 0.52 + col / 20;
          const opacity = Math.max(0.045, rowFade * colFade * 0.33);

          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r="1.15"
              fill="#d29b22"
              opacity={opacity}
            />
          );
        })}

        <path
          d="M 960 720 C 1118 695, 1245 642, 1372 570 C 1446 528, 1500 500, 1548 478"
          fill="none"
          stroke="rgba(0,0,0,0.42)"
          strokeWidth="11"
          strokeLinecap="round"
          opacity="0.18"
          filter="url(#keGoldBlur)"
        />

        <path
          d="M 960 720 C 1118 695, 1245 642, 1372 570 C 1446 528, 1500 500, 1548 478"
          fill="none"
          stroke="url(#kePanelGold)"
          strokeWidth="7.2"
          strokeLinecap="round"
          opacity="0.98"
        />

        <path
          d="M 1140 720 C 1265 673, 1395 596, 1535 512"
          fill="none"
          stroke="#d8a436"
          strokeWidth="1.1"
          strokeOpacity="0.42"
        />
      </svg>

      <div className="ke-premium-card-bg__content">{children}</div>
    </section>
  );
}
