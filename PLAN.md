# AskNostr Project Plan

Reddit-inspired Nostr client with a terminal-inspired theme and modern Swipe-Stack layout.

## Core Setup
- [x] Initialize React project with Vite & TypeScript
- [x] Setup Tailwind CSS (v4 with PostCSS)
- [x] Setup Zustand for state management
- [x] Integrate Nostr SDK (nostr-tools v2)
- [x] Integrate TanStack Query for caching
- [x] Terminal-inspired theme implementation

## Layout & UX
- [x] Classic Desktop Layout (Reddit-inspired)
- [x] Swipe-Stack Layout (Miller Columns)
- [x] Mobile-optimized gestures (Left-swipe to go back)
- [x] Peeking Header for layer context
- [x] AnimatePresence transitions via Framer Motion
- [x] Theme toggling (Terminal / Modern)
- [x] Layout toggling (Classic / Swipe)
- [x] Glassmorphism (backdrop-blur-md)
- [x] Haptic Feedback for mobile PWA
- [x] OP Highlighting: Visual marker for Original Poster in threads
- [x] Media Previews: Auto-embed logic for images/video/NIP-94

## Core Features
- [x] Feed display (Kind 1)
- [x] Post creation (NIP-07 login)
- [x] User profiles (Metadata display)
- [x] Relay management view
- [x] Communities discovery view
- [x] Responsive design
- [x] Infinite scroll feed
- [x] Real-time updates via WebSockets
- [x] Network-wide search (NIP-50)
- [x] Trending tags calculation
- [x] Thread view (NIP-10)
- [x] Recursive Depth Management: Thread tree rendering

## Engagement & Ranking Logic
- [x] Sorting Algorithms: Implement "Hot" (time-decay), "Top", and "New" filters
- [x] Reaction Aggregation: Group Kind 7 events by emoji type
- [x] Emoji Picker: Integration for custom NIP-25 reactions
- [x] Zap UX: Quick-zap buttons and real-time receipt display
- [x] Controversial Sort: Ratio logic for high-engagement/mixed-reaction posts

## NIP-72 & Community Logic
- [x] Kind 34550: Community Definitions (name, rules, moderator list)
- [x] Kind 4550: Approval events for moderating posts
- [x] Moderated Feed Filter: Show Kind 1 posts with matching Kind 4550 approval
- [x] Moderator Badge System: UI indicators for moderators
- [x] Mod Queue: Dashboard for community owners to approve/ignore posts
- [x] Community Rules Sidebar: Display rules and description from metadata
- [x] Relay Discovery: Prioritize "preferred relays" from community definition
- [x] Verification: Ensure Kind 4550 signatures match Kind 34550 moderator pubkeys
- [x] Pinned Posts: Support for `status: pinned` tags from moderators
- [x] Multi-Relay Aggregation: Fetching approvals from community-specific relays

## Community Creation & Administration
- [x] Community Creation Form: Generate Kind 34550 events
- [x] Moderator Management: Interface to add/remove moderator pubkeys
- [x] Preferred Relay Configuration: Define community relays in Kind 34550

## User Subscription Management
- [x] "Join/Leave" Interaction: Button on community headers
- [x] Joined Sidebar: Navigation for joined communities
- [x] Subscription Sync: Pull joined communities from Kind 30001/NIP-51 on login

## Advanced NIP-72 Management
- [x] Event Status Management: Tag approved posts with pinned/spam in Kind 4550
- [x] Report Flow: Send "Report" events (Kind 1984) to Mod Queue

## NIP Support
- [x] NIP-01: Basic protocol
- [x] NIP-07: Key provider integration (window.nostr)
- [x] NIP-09: Event deletion
- [x] NIP-10: Thread parsing
- [x] NIP-16: Event redaction (Kind 5)
- [x] NIP-19: Bech32 encoding (npub)
- [x] NIP-25: Reactions
- [x] NIP-50: Search
- [x] NIP-51: Lists (Community Subscriptions)
- [x] NIP-57: Zaps (Fetching & Aggregation)
- [x] NIP-65: Relay list metadata

## PWA & Performance
- [x] IndexedDB Caching: Local storage for Kind 0 (Profiles) and Kind 34550 (Metadata)
- [x] Optimistic UI: Instant feedback for Zaps, Likes, and Approvals
- [ ] Service Worker: Offline-first caching strategy via Workbox
- [ ] Advanced Error Reporting

## Testing & Compatibility
- [x] Multiple relays connectivity
- [x] Linting and Type-checking (Clean)
- [x] Cross-device responsiveness