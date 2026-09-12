import { type CSSProperties, type ReactNode } from "react";
import { cx, CountUp, Reveal } from "./primitives";
import {
  CapacityBar,
  ConsentSwitch,
  EffortBars,
  LockGlyph,
  ManageScale,
  PrivateTally,
  ShareFlow,
  ShareGlyph,
  Waveform,
  WireSweep,
  XGlyph,
} from "./visuals";

/* ------------------------------------------------------------------ */
/* Role model — the privacy ladder with a hard consent boundary        */
/* ------------------------------------------------------------------ */

function RoleRow({
  index,
  name,
  desc,
  note,
  tone,
  children,
}: {
  index: string;
  name: string;
  desc: string;
  note?: string;
  tone: "admin" | "aggregate" | "manager" | "consent" | "personal";
  children: ReactNode;
}) {
  return (
    <div className={cx("role", `role--${tone}`)}>
      <div className="role__meta">
        <span className="role__index">{index}</span>
        <h3 className="role__name">{name}</h3>
        <p className="role__desc">{desc}</p>
        {note ? <p className="role__note">{note}</p> : null}
      </div>
      <div className="role__viz">{children}</div>
    </div>
  );
}

function AdminGlyph() {
  return (
    <div className="admin-glyph" aria-hidden="true">
      <svg viewBox="0 0 120 44" className="admin-glyph__graph">
        <circle className="admin-glyph__node" cx="18" cy="22" r="3.5" />
        <circle className="admin-glyph__node" cx="60" cy="10" r="3.5" />
        <circle className="admin-glyph__node" cx="60" cy="34" r="3.5" />
        <circle className="admin-glyph__node" cx="102" cy="22" r="3.5" />
        <line className="admin-glyph__link" x1="18" y1="22" x2="60" y2="10" />
        <line className="admin-glyph__link" x1="18" y1="22" x2="60" y2="34" />
        <line className="admin-glyph__link" x1="60" y1="10" x2="102" y2="22" />
        <line className="admin-glyph__link" x1="60" y1="34" x2="102" y2="22" />
      </svg>
      <span className="admin-glyph__deny">
        <span className="dot dot--private dot--still" />
        <XGlyph className="admin-glyph__x" />
        <span className="admin-glyph__deny-label">PERSONAL DATA</span>
      </span>
    </div>
  );
}

function AggBars({
  rows,
  label,
}: {
  rows: ReadonlyArray<number>;
  label: string;
}) {
  return (
    <div className="agg" aria-hidden="true">
      <div className="agg__chart">
        {rows.map((w, i) => (
          <span
            key={i}
            className="agg__bar"
            style={{ width: `${w * 100}%`, transitionDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="agg__label">{label}</span>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Six illustrative numbers — the metrics grid                         */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* "Not surveillance" — the compact guarantee band                    */
/* ------------------------------------------------------------------ */

const NEVER: ReadonlyArray<string> = [
  "NO KEYSTROKES",
  "NO SCREENSHOTS",
  "NO MOUSE TRACKING",
  "NO RANKINGS",
  "NO DIAGNOSIS",
];

export function NotSurveillance() {
  return (
    <div className="not">
      <Reveal className="not__head">
        <p className="eyebrow eyebrow--on-ink">WHAT PULSE DOESN'T DO</p>
        <h2 className="not__title">Not surveillance!</h2>
      </Reveal>
      <Reveal className="not__list-wrap" delay={120}>
        <ul className="not__list">
          {NEVER.map((item, i) => (
            <li
              key={item}
              className="not__item"
              style={{ "--i": i } as CSSProperties}
            >
              <XGlyph className="not__x" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal className="not__foot" delay={260}>
        <p>
          We build software for <em>people</em> — not for watching them.
          Pulse only ever knows and only ever shows what
          you allow.
        </p>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Closing band                                                        */
/* ------------------------------------------------------------------ */

export function Closing() {
  return (
    <>
      <Reveal className="close__head">
        <h2 className="close__title">
          See the shape
          <br />
          of your work.
        </h2>
      </Reveal>
      <Reveal className="close__wire-wrap" delay={200}>
        <WireSweep />
      </Reveal>
      <Reveal className="close__foot" delay={360}>
        <p>
          Real records you allow. Nothing shared without your consent. No
          rankings. No diagnosis. No made-up scores.
        </p>
        <p className="close__cta">
          Personal first.
        </p>
      </Reveal>
    </>
  );
}