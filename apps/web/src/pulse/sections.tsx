import { type CSSProperties } from "react";
import { Reveal } from "./primitives";
import {
  WireSweep,
  XGlyph,
} from "./visuals";


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