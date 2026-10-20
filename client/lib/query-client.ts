import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Extracts the origin (protocol + host + port) from a URL string.
 * Handles Expo URL schemes (exp:// -> http://, exps:// -> https://)
 * For scheme-less values, defaults to https:// for production deployments
 * but the URL parsing will preserve whatever protocol is actually used.
 */
function extractOrigin(urlString: string): string {
  // Handle Expo URL schemes
  let normalized = urlString;
  if (urlString.startsWith("exp://")) {
    normalized = urlString.replace("exp://", "http://");
  } else if (urlString.startsWith("exps://")) {
    normalized = urlString.replace("exps://", "https://");
  } else if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
    // Already has a valid protocol, use as-is
    normalized = urlString;
  } else if (!urlString.includes("://")) {
    // No protocol - for Replit and most production deployments, use https
    // The static bundles are served over HTTPS via Replit's proxy
    normalized = `https://${urlString}`;
  }

  try {
    const url = new URL(normalized);
    return url.origin;
  } catch {
    // Fallback: just prepend https if parsing fails
    return `https://${urlString.split("/")[0]}`;
  }
}

/**
 * Gets the base URL for the Express API server using same-origin detection.
 * No environment variables required - works on any hosting provider.
 * 
 * Strategy:
 * - Web: window.location.origin (same-origin requests)
 *   Note: For production, Express serves both static bundles and API from port 5000.
 *   For web development via Metro (8081), use the app via port 5000 for full functionality.
 * - Native: Extract origin from Expo manifest/Constants (preserving protocol and port)
 * 
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Web platform: use same-origin
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  // Native platform: extract full origin from Expo Constants
  // The app was loaded from a manifest URL - use the same origin for API calls
  
  // Try expoConfig.hostUri first (can be "domain.com:5000" or full URL)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return extractOrigin(hostUri);
  }

  // Try manifest2 (newer Expo SDK)
  const manifest2 = Constants.manifest2;
  if (manifest2?.extra?.expoGo?.debuggerHost) {
    return extractOrigin(manifest2.extra.expoGo.debuggerHost);
  }

  // Try legacy manifest
  const manifest = Constants.manifest;
  if (manifest) {
    // @ts-ignore - manifest structure varies between SDK versions
    const host = manifest.hostUri || manifest.debuggerHost;
    if (host) {
      return extractOrigin(host);
    }
  }

  // For standalone builds, try to extract from the bundle URL
  // @ts-ignore
  const bundleUrl = Constants.expoConfig?.extra?.expoClient?.hostUri;
  if (bundleUrl) {
    return extractOrigin(bundleUrl);
  }

  // Fallback error with helpful message
  throw new Error(
    "Could not determine API URL from app origin. Ensure the app is loaded from the correct server."
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
