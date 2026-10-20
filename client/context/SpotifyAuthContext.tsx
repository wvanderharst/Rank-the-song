import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

const OAUTH_BASE_URL = "https://spotify-oauth.wouter-van-der-harst.workers.dev";

function getOAuthRedirectUrl(): string {
  const apiUrl = getApiUrl();
  const url = new URL(apiUrl);
  url.port = "";
  return `${url.href}oauth-callback`;
}
const APP_SCHEME = "top2000game";

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
      if (savedTokens && savedTokens.expiresAt > Date.now()) {
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

  const fetchTokensFromServer = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${OAUTH_BASE_URL}/me`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        console.log("No tokens available from server (user not authenticated)");
        return false;
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        const newTokens: SpotifyTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        
        await saveTokens(newTokens);
        setTokens(newTokens);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Failed to fetch tokens from server:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

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

    const success = await fetchTokensFromServer();
    if (success) {
      const refreshedTokens = await loadTokens();
      return refreshedTokens?.accessToken || null;
    }
    
    return null;
  }, [tokens, fetchTokensFromServer]);

  const login = useCallback(async () => {
    console.log(`[Spotify Auth] Starting login, Platform: ${Platform.OS}`);
    
    if (Platform.OS === "web") {
      const handshakeId = await generateHandshakeId();
      console.log(`[Spotify Auth] Generated handshake ID for web: ${handshakeId}`);
      pendingHandshakeRef.current = handshakeId;
      
      const loginUrl = `${OAUTH_BASE_URL}/login?handshakeId=${handshakeId}`;
      
      console.log(`[Spotify Auth] Opening popup: ${loginUrl}`);
      
      const popup = window.open(loginUrl, "_blank", "width=500,height=700");
      
      const pollInterval = setInterval(async () => {
        if (popup?.closed) {
          console.log("[Spotify Auth] Popup closed, checking for tokens...");
          clearInterval(pollInterval);
          
          if (pendingHandshakeRef.current) {
            const success = await fetchTokensByHandshake(pendingHandshakeRef.current);
            console.log(`[Spotify Auth] Token fetch result: ${success}`);
            pendingHandshakeRef.current = null;
          }
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(pollInterval);
        pendingHandshakeRef.current = null;
      }, 300000);
    } else {
      const handshakeId = await generateHandshakeId();
      console.log(`[Spotify Auth] Generated handshake ID: ${handshakeId}`);
      pendingHandshakeRef.current = handshakeId;
      
      const loginUrl = `${OAUTH_BASE_URL}/login?handshakeId=${handshakeId}`;
      
      console.log(`[Spotify Auth] Opening browser: ${loginUrl}`);
      
      await Linking.openURL(loginUrl);
      
      console.log(`[Spotify Auth] Browser opened, starting token polling...`);
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const pollForTokens = async (): Promise<boolean> => {
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`[Spotify Auth] Polling attempt ${attempts}/${maxAttempts}`);
          
          try {
            const success = await fetchTokensByHandshake(handshakeId);
            if (success) {
              console.log(`[Spotify Auth] Tokens retrieved successfully!`);
              return true;
            }
          } catch (error) {
            console.log(`[Spotify Auth] Poll attempt failed:`, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log(`[Spotify Auth] Polling timed out after ${maxAttempts} attempts`);
        return false;
      };
      
      await pollForTokens();
      pendingHandshakeRef.current = null;
    }
  }, [fetchTokensByHandshake]);

  const logout = useCallback(async () => {
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
