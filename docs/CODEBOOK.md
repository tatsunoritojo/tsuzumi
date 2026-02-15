# Tsuzumi Codebook

## 1. Overview
This document serves as the "Codebook" for the Tsuzumi application. It bridges the gap between the functional specifications (`mvp_specification.md`) and the actual source code, facilitating maintenance and onboarding.

### Tech Stack
- **Frontend**: React Native + Expo (SDK 52)
- **Routing**: Expo Router (File-based routing)
- **Language**: TypeScript
- **Backend Service**: Firebase (Auth, Firestore, Functions, Messaging)
- **State Management**: React Hooks (Custom hooks wrapping Firestore)

## 2. Directory Structure

### Project Tree Map

```
habit-tracker/
├── app/                          # [Frontend] Expo Router Screens
│   ├── (tabs)/                   # Main Tab Navigation
│   │   ├── _layout.tsx           # Tab Bar Config
│   │   ├── home.tsx              # 🏠 Home Screen (List of Cards)
│   │   ├── cheers.tsx            # 🤝 Cheer Suggestions (Human Cheer)
│   │   ├── notifications.tsx     # 🔔 Notifications (Received Cheers)
│   │   └── settings.tsx          # ⚙️ Settings (Preferences)
│   ├── card-detail/
│   │   └── [id].tsx              # 📅 Card Detail (Calendar, Stats)
│   ├── add-card.tsx              # ➕ Create New Card Flow
│   ├── create-custom-card.tsx    # ✏️ Custom Card Creation
│   ├── favorites.tsx             # ⭐ Favorite Users List
│   └── _layout.tsx               # Root Layout (Auth, Contexts)
│
├── src/                          # [Core Logic] Clean Architecture
│   ├── components/               # UI Components
│   │   ├── ui/                   # Generic UI (Button, Card, etc.)
│   │   ├── CheerAnimation.tsx    # Lottie Animation Wrapper
│   │   └── ...
│   ├── hooks/                    # Data Access (React Hooks)
│   │   ├── useCards.ts           # Subscribe to user's cards
│   │   ├── useCardLogs.ts        # Subscribe to logs
│   │   ├── useReactions.ts       # Subscribe to cheers
│   │   └── ...
│   ├── services/                 # Business Logic (Pure TS)
│   │   ├── logService.ts         # Record habits, Calculate streaks
│   │   ├── cheerSendService.ts   # Send cheers, limit logic
│   │   └── statsService.ts       # Date/Streak math
│   ├── types/                    # TypeScript Definitions (Data Models)
│   │   └── index.ts              # Mirrors Firestore Schema
│   └── lib/                      # Infrastructure/Config
│       ├── firebase.ts           # Firebase SDK Init
│       └── notifications.ts      # Expo Notifications Setup
│
├── functions/                    # [Backend] Cloud Functions
│   ├── src/
│   │   ├── index.ts              # Entry Point (Triggers)
│   │   └── services/             # Backend Business Logic
│   │       ├── cheerService.ts   # AI Cheer Generation
│   │       └── humanCheerService.ts # Human Cheer Notifications
│   └── package.json              # Backend Dependencies
│
└── docs/                         # [Documentation]
    ├── CODEBOOK.md               # 📘 Single Source of Truth
    └── archive/                  # 📦 Old/Superseded Docs
```

### Key Directory Responsibilities

| Directory | Type | Responsibility |
|-----------|------|----------------|
| **`app/`** | **View** | Handling navigation, screen layout, and user interactions. |
| **`src/hooks/`** | **ViewModel** | bridging Firestore data to React state. Handles subscriptions. |
| **`src/services/`** | **Model** | Enforcing business rules (streaks, limits) and performing writes. |
| **`functions/`** | **Backend** | Trusted operations (Matching, AI generation) and background tasks. |

## 3. Data Flow & Architecture

### Firestore Integration
The app uses a **direct-from-client** pattern for most read/write operations, secured by Firestore Rules (`firestore.rules`).

1. **Read**: Components use custom hooks (e.g., `useCards`) which subscribe to Firestore `onSnapshot`. This ensures real-time UI updates.
2. **Write**: User actions (e.g., tapping a log button) call Service functions (e.g., `LogService.createLog`).
3. **Validation**: Firestore Security Rules enforce permission checks (e.g., "only owner can write").

### Complex Logic (Cloud Functions)
Operations that require trusted environments or scheduling are handled by Cloud Functions:
- **Matching Pools**: Updating the candidate list for Human Cheers.
- **AI Cheers**: Scheduled generation of encouragement messages.
- **Aggregates**: Periodic statistical updates to avoid client-side heavy lifting.

## 4. Key Logic Mapping

| Feature | Specification | Key Code Location |
|---------|---------------|-------------------|
| **Log Habit** | 1-tap record | `src/services/logService.ts` (`toggleLog`) |
| **Send Cheer** | Human Cheer | `src/hooks/useReactions.ts` -> `src/services/cheerSendService.ts` |
| **Cheer Candidate** | Matching Algorithm | `functions/...` (Backend) + `src/hooks/useCheerSuggestions.ts` (Frontend) |
| **Stats/Streak** | Streak calc | `src/services/statsService.ts` |

## 5. Data Models & Types
The app uses TypeScript interfaces that mirror the Firestore data structure.
**Definition File**: `src/types/index.ts`

| Firestore Collection | TypeScript Interface | Key Fields |
|----------------------|----------------------|------------|
| `users` | `User` | `settings` (Notification prefs), `stats` (Aggregates) |
| `cards` | `Card` | `current_streak`, `is_public_for_cheers`, `reminder_time` |
| `logs` | `Log` | `logged_at` |
| `reactions` | `Reaction` | `type` (cheer/amazing/support), `from_uid`, `to_uid` |
| `matching_pools` | `MatchingPool` | `active_cards` (List of candidates for human cheers) |
| `favorites` | `Favorite` | `target_uid`, `target_card_id` |

> [!NOTE]
> `MatchingPool` is a read-only collection for the client, generated by Cloud Functions (`updateMatchingPools`).

## 6. Security & Permissions
Access is controlled via `firestore.rules`.

### General Rules
- **Authenticated Required**: Almost all operations require `request.auth != null`.
- **Owner Write**: Generally, only the `owner_uid` can write/delete their own data.

### Specific Permissions
| Collection | Read Permission | Write Permission |
|------------|-----------------|------------------|
| `users` | Authenticated (for display name) | Owner only |
| `cards` | Owner OR Public (`is_public*` flags) | Owner only |
| `logs` | Owner only | Owner only |
| `reactions` | Sender OR Receiver | Sender (create), Receiver (update read status) |
| `matching_pools` | Authenticated | **Deny** (Server-side only) |
| `favorites` | Owner only | Owner only |

---
## 7. System Architecture & Dependencies

### Module Dependency Graph

```mermaid
graph TD
    subgraph App [App / Screens]
        Home[Home Screen]
        Detail[Card Detail]
        Cheer[Cheer Screen]
    end

    subgraph Hooks [Custom Hooks (Read)]
        useCards
        useLogs[useCardLogs]
        useReactions
        useStats
    end

    subgraph Services [Services (Write)]
        LogSvc[logService]
        CheerSvc[cheerSendService]
    end

    subgraph Backend [Firebase]
        Firestore[(Firestore)]
        Auth[Auth]
    end

    Home --> useCards
    Home --> useStats
    Home --> useReactions
    Home --> LogSvc

    Detail --> useLogs
    Detail --> LogSvc

    Cheer --> useReactions
    Cheer --> CheerSvc

    useCards --> Firestore
    useLogs --> Firestore
    useReactions --> Firestore
    useStats --> Firestore

    LogSvc --> Firestore
    CheerSvc --> Firestore
```

### Data Flow Patterns

1.  **Reactive Read (Hooks)**
    `Component` -> `useHook` -> `onSnapshot (Listener)` -> `State Update` -> `Re-render`
2.  **Transactional Write (Services)**
    `Component` -> `Service.function()` -> `Firestore Write` -> `(Cloud Function Trigger)`

## 8. Module Reference

### Core Hooks (`src/hooks/`)

| Hook | Role | Dependencies | Key Data |
|------|------|--------------|----------|
| **`useCards`** | Subscribes to user's cards list. | `cards` collection | Returns `Card[]` |
| **`useCardLogs`** | Subscribes to logs for a specific card. | `logs` collection | Returns `Log[]` sorted by date |
| **`useReactions`** | Subscribes to incoming cheers. | `reactions` collection | Returns `Reaction[]` |
| **`useCheerSuggestions`** | Fetches potential cheer candidates. | `matching_pools` | Returns `CheerSuggestion[]` |
| **`useStats`** | Calculates aggregated user stats. | `logs` collection (listener) | Returns `{ weekDays, monthDays }` |
| **`useFavorites`** | Manages favorite users for cheer suggestions. | `favorites` collection | Returns `Favorite[]`, `isFavorite()`, `addFavorite()`, `removeFavorite()` |

### Core Services (`src/services/`)

#### `logService.ts`
**Role**: Handles habit log creation and streak updates.
- **`recordLog(cardId, ownerUid)`**:
  1. Creates a new doc in `logs`.
  2. Calculates new streak/total stats.
  3. Updates `cards/{cardId}` with new stats.

#### `cheerSendService.ts`
**Role**: Manages Human Cheer sending limits and logic.
- **`getCheerSuggestions(userId)`**: fetching candidates from `matching_pools` and filtering sent ones.
- **`sendCheer(from, toCard, toUid, type)`**:
  1. Checks daily limit (10/day).
  2. Checks 24h cooldown per user.
  3. Writes to `reactions`.
  4. Updates `cheer_send_state`.

#### `statsService.ts`
**Role**: Pure logic for calculating dates and streaks.
- Used by `logService` (server-side logic simulation) and `useStats`.

#### `favoriteService.ts` (Phase 10-A)
**Role**: CRUD operations for the `favorites` collection.
- **`addFavorite(ownerUid, targetUid, targetCardId, categoryL3)`**: Registers a user as favorite. Enforces 10-user limit.
- **`removeFavorite(ownerUid, targetCardId)`**: Un-favorites by card ID.
- **`isFavoriteByCardId(ownerUid, cardId)`**: Quick check for UI highlighting.
- **`getFavoritesByCategory(ownerUid, categoryL3)`**: Used by cheer suggestions to prioritize favorites.

---
