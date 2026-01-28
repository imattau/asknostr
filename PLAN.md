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
- [x] User profiles (Metadata display & Editor)
- [x] Relay management view
- [x] Communities discovery view
- [x] Responsive design
- [x] Infinite scroll feed
- [x] Real-time updates via WebSockets
- [x] Network-wide search (NIP-50)
- [x] Trending tags calculation
- [x] Thread view (NIP-10)
- [x] Recursive Depth Management: Thread tree rendering
- [x] System Menu: Functional navigation and session management
- [ ] Threading Fixes: Derive true root IDs (NIP-10), fetch full thread, and correct OP labeling
- [ ] Reply Tagging: Always include root+reply markers for direct replies
- [ ] Thread State Hygiene: Clear thread state on navigation and use EOSE/timeout to end loading

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

## Station Ownership & Recovery
- [x] Claim Community: UI for stations lacking active moderators
- [x] Admin Verification: Process to authorize new claimants
- [x] Claim Logging: Persistent trail of ownership transfers

## User Subscription Management
- [x] "Join/Leave" Interaction: Button on community headers
- [x] Joined Sidebar: Navigation for joined communities
- [x] Subscription Sync: Pull joined communities from Kind 30001/NIP-51 on login

## Advanced NIP-72 Management
- [x] Event Status Management: Tag approved posts with pinned/spam in Kind 4550
- [x] Report Flow: Send "Report" events (Kind 1984) to Mod Queue

## Advanced Discovery Logic
- [x] NIP-89 Integration: Discover handlers via Kind 31990
- [ ] Discovery Relay Support: Query specialized relays for Kind 10002
- [x] Web of Trust Crawling: Suggest communities based on "Following" activity
- [ ] Curated Labels (NIP-32): Use Kind 1985 for categorization
- [x] Relay Feature Detection: Fetch NIP-11 documents
- [x] Trending Algorithm: Rank communities by recent NIP-72 activity
- [x] NIP-05 Global Search: Verified identity and community lookup
- [x] Kind 31990 Parsing: Extract handler and app fields
- [x] Follower Graph: Map follows to community suggestions
- [x] NIP-11 Fetch: Cache relay capabilities
- [x] NIP-05 Resolution: Map usernames to public keys

## NIP-46 (Nostr Connect) Implementation
- [ ] Bunker URI Support: Parse bunker:// URIs
- [ ] NostrConnect URI Generation: QR codes for client-initiated connections
- [ ] Session Persistence: Securely store remote signer session
- [ ] Signer Interface Abstraction: Refactor signEvent for NIP-07/NIP-46
- [ ] Permission Requests: Implementation of connect/get_public_key

## PWA & Performance
- [x] IndexedDB Caching: Local storage for Kind 0 (Profiles) and Kind 34550 (Metadata)
- [x] Optimistic UI: Instant feedback for Zaps, Likes, and Approvals
- [ ] Service Worker: Offline-first caching strategy via Workbox
- [ ] Advanced Error Reporting

## Network & Performance Optimization
- [x] Relay Pooling: Limit active WebSocket connections (Capped at 8)
- [x] Subscription Batching: Combine multiple filters into single REQ calls
- [x] Web Worker Integration: Background event verification
- [ ] Adaptive Throttling: Backpressure handling for high-volume streams
- [ ] EOSE Management: Smooth historical/live transition
- [x] Exponential Backoff: Handled via SimplePool
- [x] Priority Fetching: Prioritize structural data (Kind 34550)
- [ ] Relay Input Sanitization: Validate/normalize relay URLs before subscribe/publish
- [ ] Subscription Cleanup: Close subs on EOSE or on early resolve
- [ ] Deduplication: Prevent multi-relay duplicates in reaction/approval/deletion aggregation
- [ ] Deletion Validation: Enforce NIP-09 author-matching before hiding content

## Testing & Compatibility
- [x] Multiple relays connectivity
- [x] Linting and Type-checking (Clean)
- [x] Cross-device responsiveness
