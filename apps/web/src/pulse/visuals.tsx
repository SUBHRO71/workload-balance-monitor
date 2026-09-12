import { useEffect, useRef, type CSSProperties } from "react";
import { cx } from "./primitives";

/* ------------------------------------------------------------------ */
/* Waveform — the animated workload line and its travelling pulse dot  */
/* ------------------------------------------------------------------ */

const WAVE_PATH =
  "M 48 236 " +
  "C 82 232 102 210 134 188 " +
  "C 150 177 158 168 176 152 " +
  "C 190 139 200 106 236 106 " +
  "C 262 106 272 122 288 142 " +
  "C 304 162 318 176 344 180 " +
  "C 366 184 386 198 414 212 " +
  "C 440 225 466 234 498 240 " +
  "C 538 247 590 251 712 251";

const DAYS: ReadonlyArray<{ d: string; x: number; y: number }> = [
  { d: "M", x: 48, y: 188 },
  { d: "T", x: 150, y: 152 },
  { d: "W", x: 236, y: 106 },
  { d: "T", x: 326, y: 178 },
  { d: "F", x: 414, y: 212 },
  { d: "S", x: 498, y: 240 },
  { d: "S", x: 590, y: 244 },
];

const CHECK_INS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 340, y: 182 },
  { x: 434, y: 214 },
  { x: 542, y: 242 },
];

export function Waveform({
  className,
  mini = false,
}: {
  className?: string;
  mini?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const leadRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const lead = leadRef.current;
    if (!svg || !path || !lead) return;

    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);

    let drawn = false;
    let running = true;
    let raf = 0;
    const t0 = performance.now();

    const loop = (now: number) => {
      const f = ((now - t0) % 9000) / 9000;
      const pt = path.getPointAtLength(len * f);
      lead.setAttribute(
        "transform",
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible) {
          if (!drawn) {
            drawn = true;
            path.style.transition =
              "stroke-dashoffset 2600ms cubic-bezier(.45,.05,.25,1)";
            path.style.strokeDashoffset = "0";
          }
          if (!running) {
            running = true;
            raf = requestAnimationFrame(loop);
          }
        } else {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "140px" },
    );
    io.observe(svg);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 760 300"
      className={cx("wave", mini && "wave--mini", className)}
      role="img"
      aria-label="Illustrative waveform of weekly workload effort: weekdays rise to a midweek peak near capacity and settle through the weekend."
    >
      <rect className="wave__band" x="0" y="104" width="760" height="46" />
      <line
        className="wave__gridline wave__gridline--cap"
        x1="0"
        y1="104"
        x2="760"
        y2="104"
      />
      <line
        className="wave__gridline wave__gridline--sustain"
        x1="0"
        y1="150"
        x2="760"
        y2="150"
      />
      <line
        className="wave__gridline wave__gridline--base"
        x1="0"
        y1="252"
        x2="760"
        y2="252"
      />
      <text className="wave__label" x="12" y="94">
        100% · CAPACITY
      </text>
      <text className="wave__label wave__label--dim" x="12" y="140">
        75% · SUSTAINABLE
      </text>
      <text className="wave__label wave__label--dim" x="12" y="268">
        BASELINE
      </text>

      <path
        className="wave__area"
        d="M 48 236 C 82 232 102 210 134 188 C 150 177 158 168 176 152 C 190 139 200 106 236 106 C 262 106 272 122 288 142 C 304 162 318 176 344 180 C 366 184 386 198 414 212 C 440 225 466 234 498 240 C 538 247 590 251 712 251 L 712 252 L 48 252 Z"
      />

      <path ref={pathRef} className="wave__line" d={WAVE_PATH} />

      <line className="wave__leader" x1="246" y1="98" x2="322" y2="72" />
<text className="wave__anno" x="330" y="68">
        WED · 95% · WEEKLY PEAK
      </text>

      {DAYS.map((item) => (
        <circle
          key={item.d + item.x}
          className="wave__dot"
          style={{ "--i": item.x } as CSSProperties}
          cx={item.x}
          cy={item.y}
          r="3"
        />
      ))}

      {CHECK_INS.map((item, i) => (
        <g key={i} transform={`translate(${item.x} ${item.y})`}>
          <rect
            className="wave__check"
            x="-2.6"
            y="-2.6"
            width="5.2"
            height="5.2"
            transform="rotate(45)"
          />
        </g>
      ))}

      <g ref={leadRef} className="wave__lead">
        <circle className="wave__ring wave__ring--a" r="9" />
        <circle className="wave__ring wave__ring--b" r="5.5" />
        <circle className="wave__ring wave__ring--c" r="1.8" />
      </g>
    </svg>
  );
}
/* ------------------------------------------------------------------ */
/* PulseMark — small self-drawing ECG tick used in nav / footer        */
/* ------------------------------------------------------------------ */

export function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 24"
      className={cx("pulse-mark", className)}
      aria-hidden="true"
    >
      <path
        pathLength={1}
        d="M2 12 H14 L17 12 L19 3 L22 21 L24 12 H36 L38 12 L40 7 L42 17 L44 12 H46"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Glyphs — drawn-on-reveal line icons                                 */
/* ------------------------------------------------------------------ */

export function XGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("glyph glyph--x", className)}
      aria-hidden="true"
    >
      <circle className="draw" pathLength={1} cx="12" cy="12" r="9" />
      <path className="draw" pathLength={1} d="M8.5 8.5 L15.5 15.5" />
      <path className="draw" pathLength={1} d="M15.5 8.5 L8.5 15.5" />
    </svg>
  );
}

export function LockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("glyph glyph--lock", className)}
      aria-hidden="true"
    >
      <rect
        className="draw"
        pathLength={1}
        x="5"
        y="10.5"
        width="14"
        height="10"
        rx="1.5"
      />
      <path className="draw" pathLength={1} d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5" />
    </svg>
  );
}

export function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("glyph glyph--share", className)}
      aria-hidden="true"
    >
      <path className="draw" pathLength={1} d="M12 17 V6" />
      <path className="draw" pathLength={1} d="M7 10.5 L12 6 L17 10.5" />
      <path className="draw" pathLength={1} d="M5 19 H19" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Chart atoms — animated bars, scales, flows                          */
/* ------------------------------------------------------------------ */

const BARS = [46, 58, 72, 66, 82, 74, 51, 60];

export function EffortBars() {
  return (
    <div className="bars" aria-hidden="true">
      {BARS.map((h, i) => (
        <span
          key={i}
          className="bars__bar"
          style={{ height: `${h}%`, transitionDelay: `${i * 55}ms` }}
        />
      ))}
    </div>
  );
}

export function ManageScale() {
  return (
    <div className="scale" aria-hidden="true">
      <div className="scale__track">
        <span className="scale__fill" style={{ width: "76%" }} />
        <span className="scale__knob" style={{ left: "76%" }} />
      </div>
      <div className="scale__ticks">
        {["1", "2", "3", "4", "5"].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

export function CapacityBar() {
  return (
    <div className="capacity" aria-hidden="true">
      <div className="capacity__track">
        <span className="capacity__fill" style={{ width: "95%" }} />
        <span className="capacity__line" style={{ left: "100%" }} />
      </div>
      <div className="capacity__meta">
        <span className="capacity__going">USED 38H</span>
        <span className="capacity__target">TARGET 40H</span>
      </div>
    </div>
  );
}

export function PrivateTally() {
  return (
    <div className="tally" aria-hidden="true">
      <span className="dot dot--private dot--still" />
      <span className="dot dot--private dot--still" />
      <span className="dot dot--private dot--still" />
      <span className="dot dot--private dot--still" />
      <span className="dot dot--private dot--still" />
      <span className="dot dot--private dot--still" />
      <LockGlyph className="tally__glyph" />
    </div>
  );
}

export function ShareFlow() {
  return (
    <div className="share-flow" aria-hidden="true">
      <span className="dot dot--private dot--still" />
      <span className="share-flow__wire">
        <span className="share-flow__arrow" />
      </span>
      <span className="dot dot--shared dot--still" />
    </div>
  );
}

export function ConsentSwitch() {
  return (
    <div className="consent-switch" aria-hidden="true">
      <span className="consent-switch__label">SHARED</span>
      <span className="consent-switch__track">
        <span className="consent-switch__knob" />
      </span>
      <span className="consent-switch__label consent-switch__label--dim">
        PRIVATE
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WireSweep — closing band heartbeat that draws itself on reveal      */
/* ------------------------------------------------------------------ */

export function WireSweep() {
  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className="wire"
      aria-hidden="true"
    >
      <path
        className="wire__path draw"
        pathLength={1}
        d="M0 40 H240 L280 40 L300 10 L320 40 H420 L470 40 L478 22 L486 40 H620 L660 40 L678 30 L686 50 L694 40 H780 L820 40 L830 20 L840 40 H940 L980 40 L988 26 L996 40 L1020 40 H1440"
      />
    </svg>
  );
}