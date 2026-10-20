# replit.md

## Overview

Top 2000 Game is a React Native/Expo mobile application that gamifies the Dutch Radio 2 Top 2000 music list. Users listen to random songs from the Top 2000 and try to guess the song before revealing its details (placement, artist, title, year). The app features YouTube playback integration with optional Spotify support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native/Expo)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Navigation**: React Navigation with native stack navigator (stack-only, linear flow)
- **State Management**: 
  - TanStack React Query for server state and API caching
  - React Context for local settings (play mode preference)
- **Styling**: React Native StyleSheet with a custom theme system supporting light/dark modes
- **Animations**: React Native Reanimated for smooth, performant animations
- **Media Playback**: 
  - react-native-youtube-iframe for YouTube video embedding
  - Spotify playback via client-side OAuth using expo-auth-session (users connect their own Spotify account)

### Backend (Express)

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL via Drizzle ORM with Neon serverless driver
- **Spotify Integration**: Server-side Spotify Web API client for remote playback control (legacy, now client-side)
- **API Design**: RESTful endpoints for song data (`/api/songs`, `/api/songs/random`, `/api/songs/:id`)

### Project Structure

```
client/           # React Native frontend
  screens/        # Screen components (GameScreen, SettingsScreen)
  components/     # Reusable UI components
  hooks/          # Custom React hooks
  context/        # React Context providers
  navigation/     # Navigation configuration
  constants/      # Theme and styling constants
  lib/            # API client and utilities

server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  spotify.ts      # Spotify Web API client
  db.ts           # Database connection
  seed-songs.ts   # Database seeding script

shared/           # Shared code between client and server
  schema.ts       # Drizzle database schema and Zod validation
```

### Key Design Decisions

1. **No Authentication**: Single-user game with local preferences stored in context
2. **Cross-Platform**: Web output configured for single-page app deployment
3. **Path Aliases**: `@/` maps to client, `@shared/` maps to shared code
4. **Type Safety**: Full TypeScript with strict mode, Zod for runtime validation

## External Dependencies

### Database
- **PostgreSQL** via Neon serverless (`@neondatabase/serverless`)
- Connection string required via `DATABASE_URL` environment variable
- Schema managed with Drizzle ORM and drizzle-kit for migrations

### Third-Party Services
- **YouTube**: Embedded video playback via react-native-youtube-iframe (requires valid YouTube video IDs)
- **Spotify OAuth (Client-Side)**: Users connect their own Spotify account via OAuth
  - Uses expo-auth-session with PKCE for secure OAuth flow
  - Tokens stored securely in expo-secure-store (native) or localStorage (web)
  - Direct Spotify Web API calls from the client with user's access token
  - Scopes: streaming, user-read-playback-state, user-modify-playback-state, user-read-currently-playing
  - Redirect URI: myspotifyapp://redirect (configured in Spotify Developer Dashboard)

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `EXPO_PUBLIC_DOMAIN`: API server domain for client requests
- `REPLIT_DEV_DOMAIN`: Development domain for CORS configuration
- `REPLIT_INTERNAL_APP_DOMAIN`: Production domain for builds

### Key NPM Dependencies
- Expo ecosystem (expo, expo-image, expo-haptics, etc.)
- React Navigation stack
- TanStack React Query
- Drizzle ORM with drizzle-zod
- react-native-reanimated for animations
- react-native-youtube-iframe for media
- @spotify/web-api-ts-sdk for Spotify remote control