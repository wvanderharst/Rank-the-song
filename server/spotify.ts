import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);
  
  const refreshToken = connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
  
  if (!connectionSettings || (!accessToken || !clientId || !refreshToken)) {
    throw new Error('Spotify not connected');
  }
  
  return { accessToken, clientId, refreshToken, expiresIn };
}

export async function getSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}

export async function getAvailableDevices() {
  const spotify = await getSpotifyClient();
  const devices = await spotify.player.getAvailableDevices();
  return devices.devices;
}

export async function playTrack(spotifyUri: string, deviceId?: string) {
  const spotify = await getSpotifyClient();
  
  const options: { device_id?: string } = {};
  if (deviceId) {
    options.device_id = deviceId;
  }
  
  await spotify.player.startResumePlayback(
    deviceId || "",
    undefined,
    [spotifyUri]
  );
}

export async function pausePlayback(deviceId?: string) {
  const spotify = await getSpotifyClient();
  await spotify.player.pausePlayback(deviceId || "");
}

export async function resumePlayback(deviceId?: string) {
  const spotify = await getSpotifyClient();
  await spotify.player.startResumePlayback(deviceId || "");
}

export async function getCurrentPlayback() {
  const spotify = await getSpotifyClient();
  const playback = await spotify.player.getCurrentlyPlayingTrack();
  return playback;
}

export async function getPlaybackState() {
  const spotify = await getSpotifyClient();
  const state = await spotify.player.getPlaybackState();
  return state;
}
