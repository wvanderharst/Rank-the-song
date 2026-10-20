# Dutch Radio 2 Top 2000 Music Game - Design Guidelines

## Architecture Decisions

### Authentication
**No Auth Required** - This is a single-user game/utility app with local state.
- Include a **Settings screen** accessible from a header button with:
  - User avatar selection (generate 3 Dutch-themed preset avatars: windmill silhouette, tulip icon, orange lion)
  - Display name field (default: "Music Fan")
  - Game preferences: Auto-play toggle, Show hints toggle
  - Theme preference: Light/Dark mode

### Navigation
**Stack-Only Navigation** - Linear game flow with settings modal.

Root Stack:
1. **Game Screen** (main/home) - The primary game interface
2. **Settings Screen** (modal) - Overlays game screen

### Screen Specifications

#### Game Screen
**Purpose:** Play random Top 2000 songs and reveal their information

**Layout:**
- **Header:** Custom transparent header
  - Right button: Settings icon (Feather: "settings")
  - Title: "Top 2000 Game"
  - Safe area: top inset = headerHeight + Spacing.xl
  
- **Main Content:** Non-scrollable, fixed layout
  - YouTube player container (16:9 aspect ratio, centered)
  - Game state card below player
  - Action buttons at bottom
  - Safe area: bottom inset = insets.bottom + Spacing.xl

**Components:**
- YouTube iframe embed (react-native-youtube-iframe)
- Card with conditional content:
  - **Before Reveal:** "Can you guess this song?" with music note icon
  - **After Reveal:** Placement number (large, bold), Artist name, Song title, Publication year
- Primary button: "Reveal" (hidden after reveal)
- Secondary button: "Next Song" (always visible)
- Loading spinner during song selection

**States:**
- Loading (selecting random song)
- Playing (before reveal)
- Revealed (showing all information)

#### Settings Screen
**Purpose:** Configure game preferences and user profile

**Layout:**
- **Header:** Default navigation header
  - Left button: Close (X)
  - Title: "Settings"
  
- **Main Content:** Scrollable form
  - Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

**Components:**
- Avatar picker (horizontal scroll of 3 preset options)
- Text input: Display name
- Toggle: Auto-play on load
- Toggle: Show year hint before reveal
- Theme selector: System/Light/Dark

## Design System

### Color Palette
**Primary Colors:**
- Primary: #FF6600 (Dutch orange - Radio 2 brand color)
- Primary Dark: #CC5200
- Background Light: #FFFFFF
- Background Dark: #1A1A1A

**Accent Colors:**
- Card Background Light: #F5F5F5
- Card Background Dark: #2A2A2A
- Text Primary Light: #000000
- Text Primary Dark: #FFFFFF
- Text Secondary Light: #666666
- Text Secondary Dark: #999999
- Success: #10B981 (for reveal state)

### Typography
- **Placement Number:** 72pt, Bold (after reveal)
- **Song Title:** 24pt, Semibold
- **Artist Name:** 18pt, Regular
- **Year:** 16pt, Light
- **Body Text:** 16pt, Regular
- **Button Text:** 16pt, Semibold

### Visual Design
- **YouTube Player:**
  - 16:9 aspect ratio container
  - Rounded corners: 12px
  - Margin: Spacing.lg from edges
  
- **Info Card:**
  - Rounded corners: 16px
  - Padding: Spacing.xl
  - Subtle elevation (not floating, so no shadow)
  - Smooth expand animation on reveal (300ms ease-out)
  
- **Primary Button (Reveal):**
  - Full width minus Spacing.xl margins
  - Height: 56px
  - Rounded corners: 12px
  - Background: Primary orange
  - Press feedback: Opacity 0.8
  - Icon: Feather "eye"
  
- **Secondary Button (Next Song):**
  - Full width minus Spacing.xl margins
  - Height: 48px
  - Rounded corners: 12px
  - Border: 2px solid Primary orange
  - Background: Transparent
  - Press feedback: Background Primary with 0.1 opacity
  - Icon: Feather "skip-forward"

- **Settings Button (Header):**
  - Icon only: Feather "settings"
  - Size: 24px
  - Press feedback: Scale 0.95

### Assets Required
1. **User Avatars (3 presets):**
   - Dutch windmill silhouette (circular, orange on white/dark background)
   - Tulip icon (circular, orange on white/dark background)
   - Orange lion emblem (circular, orange on white/dark background)
   
2. **Icon Usage:**
   - Use Feather icons from @expo/vector-icons
   - No emojis
   - Standard system icons for common actions

### Interaction Design
- **Reveal Animation:** Card expands vertically (300ms) showing placement → artist → song → year with staggered fade-in (50ms delay between each)
- **Next Song:** Fade out current info (200ms) → Show loading spinner → Fade in new player (200ms)
- **Button Press:** Immediate visual feedback with opacity/scale changes
- **Auto-play:** If enabled, YouTube player starts automatically when song loads

### Accessibility
- All buttons have accessible labels
- Placement number has high contrast ratio
- Minimum touch target: 44x44 points
- Support for dynamic type scaling
- VoiceOver support for reveal sequence

### Safe Area Management
- **Game Screen:** 
  - Top: headerHeight + Spacing.xl
  - Bottom: insets.bottom + Spacing.xl
- **Settings Screen:**
  - Top: Spacing.xl (has opaque header)
  - Bottom: insets.bottom + Spacing.xl