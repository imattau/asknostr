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

## NIP-72 & Community Logic
- [x] Kind 34550: Community Definitions (name, rules, moderator list)
- [x] Kind 4550: Approval events for moderating posts
- [x] Moderated Feed Filter: Show Kind 1 posts with matching Kind 4550 approval
- [x] Moderator Badge System: UI indicators for moderators
- [x] Mod Queue: Dashboard for community owners to approve/ignore posts
- [x] Community Rules Sidebar: Display rules and description from metadata
- [ ] Relay Discovery: Prioritize "preferred relays" from community definition

## NIP Support
- [x] NIP-01: Basic protocol
- [x] NIP-07: Key provider integration (window.nostr)
- [x] NIP-09: Event deletion
- [x] NIP-10: Thread parsing
- [x] NIP-19: Bech32 encoding (npub)
- [x] NIP-25: Reactions
- [x] NIP-50: Search

## Future Considerations
- [ ] NIP-51: Lists (Subscribe to communities)
- [ ] NIP-65: Relay list metadata
- [ ] NIP-57: Zaps (Lightning integration)
- [ ] NIP-46: Nostr Connect (Remote Signing)
- [ ] NIP-32: Labeling for community flairs
- [ ] Moderation Transparency Log
- [ ] PWA Optimizations
- [ ] Advanced Error Reporting

## Testing & Compatibility
- [x] Multiple relays connectivity
- [x] Linting and Type-checking (Clean)
- [x] Cross-device responsiveness
