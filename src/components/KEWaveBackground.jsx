import "./KEWaveBackground.css";

const WAVE_LINES = Array.from({ length: 58 }, (_, i) => i);
const RIGHT_FAN = Array.from({ length: 42 }, (_, i) => i);

export default function KEWaveBackground({ children, className = "" }) {
  return (
    <section className={`ke-wave-bg ${className}`}>
      <div className="ke-wave-bg__shade" />
      <div className="ke-wave-bg__glow ke-wave-bg__glow--left" />
      <div className="ke-wave-bg__glow ke-wave-bg__glow--center" />

      <svg
        className="ke-wave-bg__svg"
        viewBox="0 0 2048 881"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="keBlueLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#003a9f" stopOpacity="0" />
            <stop offset="35%" stopColor="#0068ff" stopOpacity="0.36" />
            <stop offset="68%" stopColor="#0084ff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0051ce" stopOpacity="0.28" />
          </linearGradient>

          <linearGradient id="keBlueSoft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0054d4" stopOpacity="0.02" />
            <stop offset="60%" stopColor="#0084ff" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#00378f" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="keGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#604000" stopOpacity="0" />
            <stop offset="28%" stopColor="#b98208" />
            <stop offset="58%" stopColor="#ffe456" />
            <stop offset="82%" stopColor="#c98a09" />
            <stop offset="100%" stopColor="#a96800" />
          </linearGradient>

          <filter id="softBlueBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <path
          className="ke-wave-bg__ribbon"
          d="M 430 455 C 760 500, 945 670, 1198 652 C 1428 635, 1505 375, 1690 85 L 2048 0 L 2048 881 L 860 881 C 1115 815, 1110 712, 878 658 C 690 615, 575 520, 430 455 Z"
        />

        <path
          className="ke-wave-bg__ribbon ke-wave-bg__ribbon--dark"
          d="M 690 698 C 940 593, 1150 705, 1362 622 C 1530 556, 1550 343, 1720 120 L 2048 18 L 2048 881 L 800 881 C 943 815, 948 754, 690 698 Z"
        />

        {WAVE_LINES.map((i) => {
          const t = i / (WAVE_LINES.length - 1);
          const y0 = 570 + i * 4.7;
          const c1y = 438 + i * 2.45;
          const c2y = 700 - i * 1.85;
          const yMid = 640 - i * 1.35;
          const c3y = 610 - i * 5.8;
          const c4y = 470 - i * 6;
          const yEnd = 54 + i * 7;
          const opacity = 0.035 + t * 0.34;

          return (
            <path
              key={`wave-${i}`}
              d={`
                M 310 ${y0.toFixed(1)}
                C 520 ${c1y.toFixed(1)}, 740 ${c2y.toFixed(1)}, 1055 ${yMid.toFixed(1)}
                C 1295 ${c3y.toFixed(1)}, 1465 ${c4y.toFixed(1)}, 2100 ${yEnd.toFixed(1)}
              `}
              fill="none"
              stroke="url(#keBlueLine)"
              strokeWidth={0.72 + t * 0.32}
              opacity={opacity}
            />
          );
        })}

        {RIGHT_FAN.map((i) => {
          const t = i / (RIGHT_FAN.length - 1);
          const x0 = 1285 + i * 3.4;
          const y0 = 720 - i * 2.1;
          const x1 = 1465 + i * 1.8;
          const y1 = 565 - i * 4.5;
          const x2 = 1678 + i * 4.6;
          const y2 = 265 - i * 2.8;
          const x3 = 2090;
          const y3 = 38 + i * 10.1;

          return (
            <path
              key={`fan-${i}`}
              d={`
                M ${x0.toFixed(1)} ${y0.toFixed(1)}
                C ${x1.toFixed(1)} ${y1.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}, ${x3.toFixed(1)} ${y3.toFixed(1)}
              `}
              fill="none"
              stroke="#0072ff"
              strokeWidth="0.68"
              opacity={0.04 + t * 0.22}
            />
          );
        })}

        <path
          className="ke-wave-bg__highlight"
          d="M 430 645 C 705 575, 910 642, 1118 670 C 1338 700, 1440 570, 1574 365 C 1700 170, 1850 80, 2090 -20"
        />

        <path
          className="ke-wave-bg__gold ke-wave-bg__gold-shadow"
          d="M 890 866 C 1120 865, 1352 842, 1538 785 C 1748 720, 1900 647, 2115 528"
        />

        <path
          className="ke-wave-bg__gold"
          d="M 890 866 C 1120 865, 1352 842, 1538 785 C 1748 720, 1900 647, 2115 528"
        />
      </svg>

      <div className="ke-wave-bg__content">{children}</div>
    </section>
  );
}
