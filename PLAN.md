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
- [x] Theme toggling (Terminal / Modern): High-fidelity visual overrides
- [x] Layout toggling (Classic / Swipe): Responsive defaults based on viewport
- [x] Glassmorphism (backdrop-blur-md)
- [x] Haptic Feedback for mobile PWA
- [x] OP Highlighting: Visual marker for Original Poster in threads
- [x] Media Previews: Auto-embed logic for images/video/NIP-94
- [x] Collapsable & Resizable UI: Drag handles for Miller columns and toggleable sidebars
- [x] Focus Management: Auto-scrolling to new layers in Classic view

## Core Features
- [x] Feed display (Kind 1)
- [x] Post creation (NIP-07 / NIP-46 / Local)
- [x] User profiles (Metadata display & Editor)
- [x] Relay management view (NIP-65 publishing)
- [x] Communities discovery view
- [x] Responsive design
- [x] Infinite scroll feed
- [x] Real-time updates via WebSockets
- [x] Network-wide search (NIP-50): Grouped results (Stations, Profiles, Posts)
- [x] Trending tags calculation
- [x] Thread view (NIP-10)
- [x] Recursive Depth Management: Thread tree rendering
- [x] System Menu: Functional navigation and session management
- [x] Threading Logic: Derive true root IDs (NIP-10), fetch full thread context for feed replies
- [x] Context Isolation: Drill-down views for specific comment branches
- [x] Media Servers: System menu entry for managing Blossom/Generic servers with persistent list
- [x] Unread Tracking: Last-read timestamps and badge counts for joined stations

## Composer & Engagement
- [x] Hashtag Support: Real-time highlighting and automatic NIP-12 't' tagging
- [x] Mention Support: '@' trigger suggestions, highlighting, and 'p' tagging
- [x] Non-blocking Uploads: Continue drafting while media uploads in background
- [x] Reaction Aggregation: Deduplicated by author and emoji type
- [x] Emoji Picker: Integration for custom NIP-25 reactions
- [x] Zap UX: Quick-zap buttons and real-time receipt display
- [x] Controversial Sort: Ratio logic for high-engagement/mixed-reaction posts

## Wallet & NWC Integration
- [x] NIP-47 Support: Nostr Wallet Connect integration
- [x] Wallet Settings: Secure connection string storage and status monitoring
- [x] Automated Zapping: One-tap payments via linked wallet with URI fallback

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

## Station Ownership & Administration
- [x] Community Creation Form: Generate Kind 34550 events
- [x] Moderator Management: Interface to add/remove moderator pubkeys
- [x] Preferred Relay Configuration: Define community relays in Kind 34550
- [x] Persistent Management: Owned stations saved across reloads

## Advanced Discovery Logic
- [x] NIP-89 Integration: Discover handlers via Kind 31990
- [x] Discovery Relay Support: Query specialized relays for Kind 10002
- [x] Web of Trust Crawling: Suggest communities based on "Following" activity
- [x] Curated Labels (NIP-32): Use Kind 1985 for categorization
- [x] Relay Feature Detection: Fetch NIP-11 documents
- [x] Trending Algorithm: Rank communities by recent NIP-72 activity
- [x] NIP-05 Global Search: Verified identity and community lookup
- [x] NIP-05 Resolution: Map usernames to public keys

## NIP-46 (Nostr Connect) Implementation
- [x] Bunker URI Support: Parse bunker:// URIs
- [x] NostrConnect URI Generation: QR codes for client-initiated connections
- [x] Session Persistence: Securely store remote signer session
- [x] Signer Interface Abstraction: Refactored signEvent for NIP-07/NIP-46/Local

## Performance & Optimization
- [x] Memory Management: Capped event buffer (500) and pending buffer
- [x] Garbage Collection: Aggressive TanStack Query purging for off-screen metadata
- [x] Relay Pooling: Limit active WebSocket connections (Capped at 8)
- [x] Subscription Batching: Combine multiple filters into single REQ calls
- [x] Web Worker Integration: Background event verification
- [x] Virtualization: `react-window` integration for all feeds
- [x] Portals: Render heavy overlays (Share menu) at body level to prevent clipping

## Testing & Compatibility
- [x] Multiple relays connectivity
- [x] Linting and Type-checking (Clean)
- [x] Cross-device responsiveness