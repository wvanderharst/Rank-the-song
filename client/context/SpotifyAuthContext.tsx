import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

const OAUTH_BASE_URL = "https://spotify-oauth.wouter-van-der-harst.workers.dev";

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SpotifyAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  fetchTokensFromServer: () => Promise<boolean>;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = "spotify_tokens";

async function saveTokens(tokens: SpotifyTokens): Promise<void> {
  const data = JSON.stringify(tokens);
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_STORAGE_KEY, data);
  } else {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, data);
  }
}

async function loadTokens(): Promise<SpotifyTokens | null> {
  try {
    let data: string | null;
    if (Platform.OS === "web") {
      data = localStorage.getItem(TOKEN_STORAGE_KEY);
    } else {
      data = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    }
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load tokens:", error);
  }
  return null;
}

async function clearTokens(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
  }
}

async function generateHandshakeId(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(new Uint8Array(randomBytes))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function SpotifyAuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pendingHandshakeRef = useRef<string | null>(null);

  useEffect(() => {
    loadTokens().then((savedTokens) => {
      // Expired tokens are kept when they can be renewed with the refresh token.
      if (savedTokens && (savedTokens.expiresAt > Date.now() || savedTokens.refreshToken)) {
        setTokens(savedTokens);
      }
      setIsLoading(false);
    });
  }, []);

  const fetchTokensByHandshake = useCallback(async (handshakeId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log(`[Spotify Auth] Fetching tokens for handshake: ${handshakeId}`);
      const url = `${OAUTH_BASE_URL}/sessions/${handshakeId}`;
      console.log(`[Spotify Auth] Fetching from: ${url}`);
      const response = await fetch(url);
      
      console.log(`[Spotify Auth] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[Spotify Auth] Error response: ${errorText}`);
        return false;
      }
      
      const data = await response.json();
      console.log(`[Spotify Auth] Response data keys: ${Object.keys(data).join(", ")}`);
      
      if (data.access_token) {
        const newTokens: SpotifyTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        
        await saveTokens(newTokens);
        setTokens(newTokens);
        if (pendingHandshakeRef.current === handshakeId) {
          pendingHandshakeRef.current = null;
        }
        console.log("[Spotify Auth] Tokens saved successfully!");
        return true;
      }
      
      console.log("[Spotify Auth] No access_token in response");
      return false;
    } catch (error) {
      console.error("[Spotify Auth] Failed to fetch tokens by handshake:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTokens = useCallback(async (refreshToken: string): Promise<SpotifyTokens | null> => {
    try {
      const response = await fetch(`${OAUTH_BASE_URL}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        console.log(`[Spotify Auth] Token refresh failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (!data.access_token) return null;

      const newTokens: SpotifyTokens = {
        accessToken: data.access_token,
        // Spotify only sometimes rotates the refresh token.
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };

      await saveTokens(newTokens);
      setTokens(newTokens);
      return newTokens;
    } catch (error) {
      console.error("[Spotify Auth] Failed to refresh tokens:", error);
      return null;
    }
  }, []);

  // "Refresh Connection": finishes a login that is still pending, or renews the saved tokens.
  const fetchTokensFromServer = useCallback(async (): Promise<boolean> => {
    if (pendingHandshakeRef.current) {
      return fetchTokensByHandshake(pendingHandshakeRef.current);
    }

    const savedTokens = await loadTokens();
    if (!savedTokens?.refreshToken) {
      return false;
    }

    try {
      setIsLoading(true);
      return (await refreshTokens(savedTokens.refreshToken)) !== null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTokensByHandshake, refreshTokens]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      
      if (url.includes("oauth-complete")) {
        const parsed = Linking.parse(url);
        const handshakeId = parsed.queryParams?.handshakeId as string | undefined;
        
        if (handshakeId) {
          await fetchTokensByHandshake(handshakeId);
        }
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchTokensByHandshake]);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;

    if (tokens.expiresAt > Date.now() + 60000) {
      return tokens.accessToken;
    }

    const refreshed = tokens.refreshToken ? await refreshTokens(tokens.refreshToken) : null;
    if (refreshed) {
      return refreshed.accessToken;
    }

    // Could not renew: sign out so the app asks to connect Spotify again.
    await clearTokens();
    setTokens(null);
    return null;
  }, [tokens, refreshTokens]);

  const login = useCallback(async () => {
    console.log(`[Spotify Auth] Starting login, Platform: ${Platform.OS}`);

    const handshakeId = await generateHandshakeId();
    pendingHandshakeRef.current = handshakeId;

    const loginUrl = `${OAUTH_BASE_URL}/login?handshakeId=${handshakeId}`;
    console.log(`[Spotify Auth] Opening login: ${loginUrl}`);

    let popup: Window | null = null;
    if (Platform.OS === "web") {
      popup = window.open(loginUrl, "_blank", "width=500,height=700");
    } else {
      await Linking.openURL(loginUrl);
    }

    // The login service keeps the tokens under the handshake id until we fetch them.
    // Poll for them instead of waiting for the popup to close: Spotify's login page
    // can cut the link to the popup, so popup.closed is not reliable.
    const maxAttempts = 150;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Stop when another login was started or this one already finished.
      if (pendingHandshakeRef.current !== handshakeId) return;

      if (await fetchTokensByHandshake(handshakeId)) {
        console.log(`[Spotify Auth] Tokens retrieved successfully!`);
        try {
          popup?.close();
        } catch {}
        return;
      }
    }

    console.log(`[Spotify Auth] Login timed out after ${maxAttempts} attempts`);
    if (pendingHandshakeRef.current === handshakeId) {
      pendingHandshakeRef.current = null;
    }
  }, [fetchTokensByHandshake]);

  const logout = useCallback(async () => {
    pendingHandshakeRef.current = null;
    await clearTokens();
    setTokens(null);
  }, []);

  return (
    <SpotifyAuthContext.Provider
      value={{
        isAuthenticated: !!tokens,
        isLoading,
        accessToken: tokens?.accessToken || null,
        login,
        logout,
        getValidAccessToken,
        fetchTokensFromServer,
      }}
    >
      {children}
    </SpotifyAuthContext.Provider>
  );
}

export function useSpotifyAuth() {
  const context = useContext(SpotifyAuthContext);
  if (context === undefined) {
    throw new Error("useSpotifyAuth must be used within a SpotifyAuthProvider");
  }
  return context;
}
