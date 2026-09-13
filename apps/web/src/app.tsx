import { useEffect, useState, type CSSProperties } from "react";
import { PulseLoader } from "./pulse/loader";
import { cx, CountUp, Parallax, Reveal } from "./pulse/primitives";
import { PulseMark, Waveform } from "./pulse/visuals";
import {
  Closing,
  NotSurveillance,
} from "./pulse/sections";
import { Navigation, type NavTab } from "./components/Navigation";
import { WorkloadProvider, useWorkload } from "./context/WorkloadContext";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { CheckInsPage } from "./pages/CheckInsPage";
import { PrivateItemsPage } from "./pages/PrivateItemsPage";
import { TrendsPage } from "./pages/TrendsPage";
import { SharingPage } from "./pages/SharingPage";
import { ManagerPage } from "./pages/ManagerPage";
import { HrPage } from "./pages/HrPage";
import { AdminPage } from "./pages/AdminPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthProvider, useAuth } from "./auth";

const ROUTE_TO_TAB: Record<string, NavTab> = {
  "": "dashboard",
  tasks: "tasks",
  "check-ins": "checkins",
  checkins: "checkins",
  private: "private",
  trends: "trends",
  sharing: "sharing",
  notifications: "notifications",
  privacy: "privacy",
  settings: "settings",
  manager: "manager",
  hr: "hr",
  admin: "admin",
};

const TAB_TO_ROUTE: Record<NavTab, string> = {
  dashboard: "",
  tasks: "tasks",
  checkins: "check-ins",
  private: "private",
  trends: "trends",
  sharing: "sharing",
  manager: "manager",
  hr: "hr",
  admin: "admin",
  notifications: "notifications",
  privacy: "privacy",
  settings: "settings",
};

function Nav() {
  return (
    <header className="nav">
      <a className="nav__brand" href="#top">
        <PulseMark className="nav__mark" />
        <span className="nav__word">PULSE</span>
      </a>

      <a className="underline" href="/app">
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
  return <AuthProvider>{window.location.pathname.startsWith("/app") || window.location.pathname === "/auth/callback" ? <DashboardRoute /> : <LandingPage />}</AuthProvider>;
}

function LandingPage() {
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

function DashboardRoute() {
  const auth = useAuth();

  const activeMembership = auth.memberships.find((membership) => membership.status === "active");
  const roles = activeMembership?.roles ?? [];
  const isManager = roles.includes("manager");
  const isHr = roles.includes("hr");
  const isAdmin = roles.includes("org_admin");
  const workTabs: NavTab[] = [
    ...(isManager ? (["manager"] as NavTab[]) : []),
    ...(isHr ? (["hr"] as NavTab[]) : []),
    ...(isAdmin ? (["admin"] as NavTab[]) : []),
  ];
  const allowedTabs: NavTab[] = workTabs.length > 0 ? workTabs : [
    "dashboard", "tasks", "checkins", "private", "trends", "sharing", "notifications", "privacy", "settings",
  ];
  const defaultTab: NavTab = allowedTabs[0] ?? "dashboard";
  const urlSegment = ROUTE_TO_TAB[window.location.pathname.split("/")[2] ?? ""];
  const [activeTab, setActiveTab] = useState<NavTab>(
    urlSegment && allowedTabs.includes(urlSegment) ? urlSegment : defaultTab,
  );

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) setActiveTab(defaultTab);
  }, [activeTab, allowedTabs.join("|")]);

  useEffect(() => {
    const handlePopState = () => {
      const routeTab = ROUTE_TO_TAB[window.location.pathname.split("/")[2] ?? ""] ?? defaultTab;
      setActiveTab(allowedTabs.includes(routeTab) ? routeTab : defaultTab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allowedTabs.join("|"), defaultTab]);

  if (auth.loading) return <AuthLoading />;
  if (!auth.authenticated) return <LoginPage />;

  const selectedTab = allowedTabs.includes(activeTab) ? activeTab : defaultTab;
  const selectTab = (tab: NavTab) => {
    if (!allowedTabs.includes(tab)) return;
    setActiveTab(tab);
    window.history.pushState({}, "", tab === "dashboard" ? "/app" : `/app/${TAB_TO_ROUTE[tab]}`);
  };

  return (
    <WorkloadProvider>
      <Navigation
        activeTab={selectedTab}
        onSelectTab={selectTab}
        allowedTabs={allowedTabs}
      />
      <WorkspaceLoadNotice />
      <main className="workspace-main">
        {selectedTab === "dashboard" && <DashboardPage onNavigate={selectTab} />}
        {selectedTab === "tasks" && <TasksPage />}
        {selectedTab === "checkins" && <CheckInsPage />}
        {selectedTab === "private" && <PrivateItemsPage />}
        {selectedTab === "trends" && <TrendsPage />}
        {selectedTab === "sharing" && <SharingPage />}
        {selectedTab === "manager" && <ManagerPage />}
        {selectedTab === "hr" && <HrPage />}
        {selectedTab === "admin" && <AdminPage />}
        {selectedTab === "notifications" && <NotificationsPage />}
        {selectedTab === "privacy" && <PrivacyPage />}
        {selectedTab === "settings" && <SettingsPage />}
      </main>
    </WorkloadProvider>
  );
}

function WorkspaceLoadNotice() {
  const { workspaceLoadError } = useWorkload();
  if (!workspaceLoadError) return null;
  return <div role="alert" className="workspace-load-error">{workspaceLoadError}</div>;
}

function AuthLoading({ message = "Loading your workspace…" }: { message?: string }) {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}><p>{message}</p></main>;
}

function LoginPage() {
  const auth = useAuth();
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f8f5", padding: 24 }}>
    <section style={{ maxWidth: 440, width: "100%", background: "white", borderRadius: 18, padding: 36, boxShadow: "0 12px 40px rgba(25,55,40,.12)" }}>
      <div style={{ color: "#276749", fontWeight: 800, letterSpacing: ".12em", fontSize: 13 }}>PULSE / WORKLOAD BALANCE</div>
      <h1 style={{ marginBottom: 10 }}>Sign in to your workspace</h1>
      <p style={{ color: "#52635a", lineHeight: 1.5 }}>Use your organization account. Your available workspace pages are determined by your current membership roles.</p>
      {auth.error && <p role="alert" style={{ color: "#a33", background: "#fff1f1", padding: 12, borderRadius: 8 }}>{auth.error}</p>}
      <button onClick={auth.login} style={{ width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#276749", color: "white", fontWeight: 700, cursor: "pointer" }}>Continue with secure sign-in</button>
      <a href="/" style={{ display: "block", marginTop: 18, textAlign: "center", color: "#52635a" }}>Back to landing page</a>
    </section>
  </main>;
}
