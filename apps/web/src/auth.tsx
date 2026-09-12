import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Membership } from "@workload/contracts";

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const redirectUri = `${window.location.origin}/auth/callback`;

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  accessToken?: string;
  memberships: Membership[];
  error?: string;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

async function exchangeCode(code: string): Promise<{ access_token: string; id_token?: string }> {
  if (!cognitoDomain || !clientId) throw new Error("Cognito configuration is missing");
  const response = await fetch(`${cognitoDomain.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri }),
  });
  if (!response.ok) throw new Error("Unable to complete sign-in");
  return (await response.json()) as { access_token: string; id_token?: string };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string>();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const tokens = await exchangeCode(code);
          sessionStorage.setItem("workload.accessToken", tokens.access_token);
          if (tokens.id_token) sessionStorage.setItem("workload.idToken", tokens.id_token);
          window.history.replaceState({}, "", "/app");
        }
        const token = sessionStorage.getItem("workload.accessToken") ?? undefined;
        if (!token) return;
        if (!apiUrl) throw new Error("VITE_API_URL is missing");
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/me`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Your session is not authorized" : "Unable to load your workspace");
        const profile = (await response.json()) as { memberships: Membership[] };
        if (!cancelled) {
          setAccessToken(token);
          setMemberships(profile.memberships ?? []);
        }
      } catch (caught) {
        sessionStorage.removeItem("workload.accessToken");
        sessionStorage.removeItem("workload.idToken");
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Sign-in failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading,
    authenticated: Boolean(accessToken),
    memberships,
    ...(accessToken ? { accessToken } : {}),
    ...(error ? { error } : {}),
    login: () => {
      if (!cognitoDomain || !clientId) { setError("Cognito configuration is missing"); return; }
      const url = new URL(`${cognitoDomain.replace(/\/$/, "")}/oauth2/authorize`);
      url.search = new URLSearchParams({ client_id: clientId, response_type: "code", scope: "openid email profile workload-monitor/read", redirect_uri: redirectUri }).toString();
      window.location.assign(url.toString());
    },
    logout: () => {
      sessionStorage.clear();
      setAccessToken(undefined);
      setMemberships([]);
      window.history.replaceState({}, "", "/");
      window.location.reload();
    },
  }), [accessToken, error, loading, memberships]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function getAuthToken(): string | undefined {
  return sessionStorage.getItem("workload.accessToken") ?? undefined;
}
