import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import type { Membership } from "@workload/contracts";

WebBrowser.maybeCompleteAuthSession();

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "";
const USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID ?? "";

// Derive Cognito domain from pool id: pool id format is <region>_<id>
const region = USER_POOL_ID.split("_")[0] ?? "us-east-1";
const cognitoDomain = `https://cognito-idp.${region}.amazonaws.com/${USER_POOL_ID}`;

const TOKEN_KEY = "workload.accessToken";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${cognitoDomain}/oauth2/authorize`,
  tokenEndpoint: `${cognitoDomain}/oauth2/token`,
  revocationEndpoint: `${cognitoDomain}/oauth2/revoke`,
};

export interface AuthState {
  loading: boolean;
  authenticated: boolean;
  accessToken?: string;
  memberships: Membership[];
  error?: string;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "workload-monitor" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ["openid", "email", "profile", "workload-monitor/read"],
      redirectUri,
      usePKCE: true,
    },
    discovery,
  );

  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState<string | undefined>();

  // On mount: restore saved token and fetch profile
  useEffect(() => {
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) await loadProfile(saved);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle auth response from browser
  useEffect(() => {
    if (response?.type !== "success") {
      if (response?.type === "error") {
        setError(response.error?.message ?? "Sign-in failed");
        setLoading(false);
      }
      return;
    }
    const { code } = response.params;
    if (!code || !request?.codeVerifier) return;
    setLoading(true);
    void exchangeCode(code, request.codeVerifier, redirectUri).then(async (token) => {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await loadProfile(token);
      setLoading(false);
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    });
  }, [response]);

  async function exchangeCode(code: string, verifier: string, redirect: string): Promise<string> {
    const res = await fetch(`${cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        redirect_uri: redirect,
        code_verifier: verifier,
      }).toString(),
    });
    if (!res.ok) throw new Error("Token exchange failed");
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  async function loadProfile(token: string) {
    const res = await fetch(`${API_URL}/v1/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      throw new Error("Session expired. Please sign in again.");
    }
    const data = (await res.json()) as { memberships: Membership[] };
    setAccessToken(token);
    setMemberships(data.memberships ?? []);
    setError(undefined);
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      authenticated: Boolean(accessToken),
      accessToken,
      memberships,
      error,
      login: () => {
        setError(undefined);
        void promptAsync();
      },
      logout: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAccessToken(undefined);
        setMemberships([]);
      },
    }),
    [loading, accessToken, memberships, error, promptAsync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}