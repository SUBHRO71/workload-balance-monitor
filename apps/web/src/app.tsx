import { useEffect, useState, type CSSProperties } from "react";
import { colors } from "@workload/design-tokens";
import { PulseLoader } from "./pulse/loader";
import { cx, CountUp, Parallax, Reveal } from "./pulse/primitives";
import { PulseMark, Waveform } from "./pulse/visuals";
import {
  Closing,
  NotSurveillance,
} from "./pulse/sections";

function Nav() {
  return (
    <header className="nav">
      <a className="nav__brand" href="#top">
        <PulseMark className="nav__mark" />
        <span className="nav__word">PULSE</span>
      </a>

      <a className="underline" href="#get-started">
        Get Started
      </a>
    </header>
  );
}

function HeroStats() {
  return (
    <div className="hero-stats">
      <div className="hero-stats__cell">
        <span className="hero-stats__label">EFFORT</span>
        <span className="hero-stats__value">
          <CountUp to={68} suffix="%" />
        </span>
        <span className="hero-stats__unit">of capacity</span>
      </div>
      <div className="hero-stats__cell">
        <span className="hero-stats__label">MANAGEABLE</span>
        <span className="hero-stats__value">
          <CountUp to={3.8} decimals={1} />
        </span>
        <span className="hero-stats__unit">of 5 · your rating</span>
      </div>
      <div className="hero-stats__cell">
        <span className="hero-stats__label">SHARED</span>
        <span className="hero-stats__value">
          <CountUp to={2} />
        </span>
        <span className="hero-stats__unit">of 14 records</span>
      </div>
    </div>
  );
}

function Hero() {
  const anim = (ms: number): CSSProperties => ({ transitionDelay: `${ms}ms` });
  return (
    <section className="hero">
      <div className="hero__grid">
        <div className="hero__copy">
          
          <h1 className="hero__title hero-anim" style={anim(180)}>
            See the shape
            <br />
            of your work.
          </h1>
          <p className="hero__lede hero-anim" style={anim(320)}>
            Your workload. Your check-ins. Your call. Pulse keeps them
            private, and shares only what you choose.
          </p>
          
        </div>

        <Parallax className="hero__fx" factor={-0.04}>
          <Reveal className="wave-card" delay={140}>
            <header className="wave-card__head">
              <span className="wave-card__title">
                <span className="wave-card__pulse" aria-hidden="true" />
                YOUR WEEK
              </span>
              <span className="tag">ILLUSTRATIVE</span>
            </header>
            <div className="wave-card__body">
              <Waveform />
            </div>
            <HeroStats />
          </Reveal>
        </Parallax>
      </div>

      
    </section>
  );
}


function NumbersSection() {
  return (
    <section className="section section--numbers" id="numbers">
      <div className="container container--wide">
        <div className="section__head section__head--row">
          <div>
            <Reveal>
              <p className="eyebrow">THE SIX NUMBERS</p>
            </Reveal>
            <Reveal delay={90}>
              <h2 className="section__title">Your numbers. Your call.</h2>
            </Reveal>
          </div>
          <Reveal delay={160}>
            <p className="demo-note">
              <span className="demo-note__dot" aria-hidden="true" />
              ILLUSTRATIVE DEMO DATA — NOT REAL PEOPLE, NOT REAL STATISTICS
            </p>
          </Reveal>
        </div>
        
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="section section--privacy" id="privacy">
      <div className="container">
        <NotSurveillance />
      </div>
    </section>
  );
}

function ClosingSection() {
  return (
    <section className="section section--close">
      <div className="container">
        <Closing />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__row">
        <span className="footer__brand">
          <PulseMark className="footer__mark" />
          <span className="nav__word">PULSE</span>
        </span>
        <p className="footer__motto">
          Consent first. No rankings. Humans decide.
        </p>
      </div>
      <div className="footer__row">
        <p className="footer__law">
          Frontend concept page — illustrative animations only. No data is
          collected here. No employees, companies or scores are shown.
        </p>
        <p className="footer__year">© 2026 WORKLOAD BALANCE MONITOR</p>
      </div>
    </footer>
  );
}

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add("is-loading");
    const t = setTimeout(() => {
      setReady(true);
      document.body.classList.remove("is-loading");
    }, 1000);
    return () => {
      clearTimeout(t);
      document.body.classList.remove("is-loading");
    };
  }, []);

  return (
    <>
      <PulseLoader done={ready} />
      <div className={cx("page", ready && "page--ready")} id="top">
        <Nav />
        <main>
          <Hero />
          <PrivacySection />
          <ClosingSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
