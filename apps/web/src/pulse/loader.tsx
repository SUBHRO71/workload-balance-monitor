import { cx } from "./primitives";

/**
 * One-second brand loader: a signal line draws, pulses emanate from it,
 * then PULSE settles into place. The parent unmounts/visibly removes the
 * overlay after ~1s.
 */
export function PulseLoader({ done }: { done: boolean }) {
  return (
    <div className={cx("loader", done && "loader--done")} aria-hidden={done}>
      <div className="loader__stage">
        <svg className="loader__tick" viewBox="0 0 240 64" aria-hidden="true">
          <path
            pathLength={1}
            d="M8 32 H58 L70 32 L74 10 L79 54 L84 32 H128 L140 32 L144 18 L148 46 L152 32 H196 L206 32"
          />
        </svg>
        <span className="loader__word" aria-hidden="true">
          PULSE
        </span>
      </div>
    </div>
  );
}