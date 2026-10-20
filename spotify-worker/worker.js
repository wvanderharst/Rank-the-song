// Spotify login service for Rank The Song (Cloudflare Worker).
//
// Flow: the app opens /login?handshakeId=<random id>&redirectUri=<return url>,
// the user logs in at Spotify, Spotify sends them to /callback, and the tokens
// are kept for 10 minutes under that handshake id. The user is then sent back
// to <return url>?handshakeId=<id> (the website, or the phone app via its
// top2000game:// link), where the app picks the tokens up from /sessions/<id>.
// The app later renews them with POST /refresh.
//
// Needs: KV namespace bound as TOKENS, and the variables SPOTIFY_CLIENT_ID,
// SPOTIFY_CLIENT_SECRET (secret) and REDIRECT_URI (this worker's /callback URL,
// also listed under Redirect URIs in the Spotify Developer Dashboard).

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
].join(" ");

// Addresses the user may be sent back to after login. Add your own domain here
// if the website moves (e.g. "https://www.example.com/").
const ALLOWED_REDIRECT_PREFIXES = [
  "top2000game://",
  "https://wvanderharst.github.io/Rank-the-song/",
];

function isAllowedRedirect(redirectUri) {
  return !!redirectUri && ALLOWED_REDIRECT_PREFIXES.some((prefix) => redirectUri.startsWith(prefix));
}

const HANDSHAKE_ID_PATTERN = /^[0-9a-f]{32}$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/login") return redirectToSpotify(env, url);
    if (url.pathname === "/callback") return handleCallback(env, url);
    if (url.pathname.startsWith("/sessions/")) {
      return getSession(env, url.pathname.split("/")[2]);
    }
    if (url.pathname === "/refresh" && request.method === "POST") {
      return refreshTokens(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function spotifyTokenRequest(env, params) {
  return fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(env.SPOTIFY_CLIENT_ID + ":" + env.SPOTIFY_CLIENT_SECRET),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
}

/* -------------------- LOGIN -------------------- */
function redirectToSpotify(env, url) {
  const handshakeId = url.searchParams.get("handshakeId");
  if (!handshakeId || !HANDSHAKE_ID_PATTERN.test(handshakeId)) {
    return new Response("Missing or invalid handshakeId", { status: 400 });
  }

  const redirectUri = url.searchParams.get("redirectUri");
  const state = JSON.stringify({
    handshakeId,
    redirectUri: isAllowedRedirect(redirectUri) ? redirectUri : null,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: env.REDIRECT_URI,
    state,
  });

  return Response.redirect("https://accounts.spotify.com/authorize?" + params.toString(), 302);
}

/* -------------------- CALLBACK -------------------- */
async function handleCallback(env, url) {
  let handshakeId = null;
  let redirectUri = null;
  try {
    ({ handshakeId, redirectUri } = JSON.parse(url.searchParams.get("state") || "{}"));
  } catch {}

  const code = url.searchParams.get("code");
  if (!code) {
    // Cancelled at Spotify: send the user back without a login.
    if (isAllowedRedirect(redirectUri)) {
      return Response.redirect(redirectUri, 302);
    }
    return resultPage("Spotify login was cancelled", "You can close this window and try again.");
  }

  if (!handshakeId || !HANDSHAKE_ID_PATTERN.test(handshakeId)) {
    return new Response("Invalid login state", { status: 400 });
  }

  const tokenRes = await spotifyTokenRequest(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: env.REDIRECT_URI,
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    return resultPage("Spotify login failed", "Please close this window and try again.");
  }

  // Each login gets its own entry, picked up once by the app via /sessions/<id>.
  await env.TOKENS.put(`session_${handshakeId}`, JSON.stringify(tokens), { expirationTtl: 600 });

  if (isAllowedRedirect(redirectUri)) {
    const back = new URL(redirectUri);
    back.searchParams.set("handshakeId", handshakeId);
    return Response.redirect(back.toString(), 302);
  }

  return resultPage("Spotify connected!", "You can close this window and go back to the game.");
}

function resultPage(title, message) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;
      background: linear-gradient(135deg, #1DB954 0%, #191414 100%); color: white; text-align: center; }
    div { padding: 40px; background: rgba(0,0,0,0.3); border-radius: 16px; margin: 16px; }
  </style>
</head>
<body>
  <div><h1>${title}</h1><p>${message}</p></div>
  <script>setTimeout(function () { window.close(); }, 1500);</script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* -------------------- SESSION RETRIEVAL -------------------- */
async function getSession(env, handshakeId) {
  if (!handshakeId || !HANDSHAKE_ID_PATTERN.test(handshakeId)) {
    return json({ error: "Invalid handshakeId" }, 400);
  }

  const data = await env.TOKENS.get(`session_${handshakeId}`);
  if (!data) return json({ error: "No session found" }, 404);

  // One-time pickup.
  await env.TOKENS.delete(`session_${handshakeId}`);

  return new Response(data, { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

/* -------------------- REFRESH TOKEN -------------------- */
async function refreshTokens(request, env) {
  let refreshToken;
  try {
    ({ refresh_token: refreshToken } = await request.json());
  } catch {}
  if (!refreshToken) return json({ error: "refresh_token is required" }, 400);

  const res = await spotifyTokenRequest(env, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const data = await res.json();

  return json(data, res.ok ? 200 : 401);
}
