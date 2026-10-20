import { useEffect, useRef, useCallback, memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        options: {
          height?: number;
          width?: number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YouTubePlayerWebProps {
  videoId: string;
  width: number;
  height: number;
  play?: boolean;
  mute?: boolean;
  // false: new videos are only cued, and start when `play` becomes true.
  autoplay?: boolean;
  onReady?: () => void;
  onChangeState?: (state: string) => void;
}

const PLAYER_STATES: Record<number, string> = {
  [-1]: 'unstarted',
  [0]: 'ended',
  [1]: 'playing',
  [2]: 'paused',
  [3]: 'buffering',
  [5]: 'video cued',
};

function YouTubePlayerWebComponent({
  videoId,
  width,
  height,
  play = true,
  mute = true,
  autoplay = true,
  onReady,
  onChangeState,
}: YouTubePlayerWebProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const isApiReady = useRef(false);
  const currentVideoId = useRef<string | null>(null);
  const isPlayerReady = useRef(false);
  // Latest props for the player's ready event, which is bound when the player is created.
  const playRef = useRef(play);
  const muteRef = useRef(mute);
  playRef.current = play;
  muteRef.current = mute;

  const handleStateChange = useCallback(
    (event: { data: number }) => {
      const stateName = PLAYER_STATES[event.data] || 'unknown';
      onChangeState?.(stateName);
    },
    [onChangeState]
  );

  const handlePlayerReady = useCallback(
    (event: { target: YTPlayer }) => {
      isPlayerReady.current = true;
      if (muteRef.current) {
        event.target.mute();
      }
      if (playRef.current) {
        event.target.playVideo();
      }
      onReady?.();
    },
    [onReady]
  );

  const loadVideo = useCallback((id: string) => {
    if (!id || id === '') return;
    if (playerRef.current && isPlayerReady.current && id !== currentVideoId.current) {
      currentVideoId.current = id;
      if (!autoplay) {
        playerRef.current.cueVideoById(id, 0);
        return;
      }
      playerRef.current.loadVideoById(id, 0);
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.playVideo();
        }
      }, 100);
    }
  }, [autoplay]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        isApiReady.current = true;
        return;
      }

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        isApiReady.current = true;
      };
    };

    loadYouTubeAPI();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
      isPlayerReady.current = false;
      currentVideoId.current = null;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!videoId || videoId === '') return;

    const tryInitOrLoad = () => {
      if (!isApiReady.current) {
        const checkApi = setInterval(() => {
          if (window.YT && window.YT.Player) {
            isApiReady.current = true;
            clearInterval(checkApi);
            tryInitOrLoad();
          }
        }, 100);
        return;
      }

      if (!playerRef.current && containerRef.current) {
        const playerId = `yt-player-${Date.now()}`;
        const playerDiv = document.createElement('div');
        playerDiv.id = playerId;
        containerRef.current.appendChild(playerDiv);

        currentVideoId.current = videoId;
        playerRef.current = new window.YT.Player(playerId, {
          height,
          width,
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            mute: mute ? 1 : 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: handlePlayerReady,
            onStateChange: handleStateChange,
          },
        });
      } else if (playerRef.current && isPlayerReady.current) {
        loadVideo(videoId);
      }
    };

    tryInitOrLoad();
  }, [videoId, width, height, autoplay, mute, handlePlayerReady, handleStateChange, loadVideo]);

  useEffect(() => {
    if (playerRef.current && isPlayerReady.current) {
      if (mute) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    }
  }, [mute]);

  useEffect(() => {
    if (playerRef.current && isPlayerReady.current) {
      if (play) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [play]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <div ref={containerRef} style={{ width, height }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
  },
});

export const YouTubePlayerWeb = memo(YouTubePlayerWebComponent);
