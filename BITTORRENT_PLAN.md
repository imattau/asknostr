# BitTorrent Storage Integration Plan

## Goal
Enable decentralized, peer-to-peer storage and retrieval of Nostr media and large events using WebTorrent. This allows users to share content without relying on centralized media servers.

## Discrete Tasks

### Phase 1: Infrastructure and Services
1.  **Add Dependencies:**
    *   Install `webtorrent` and its types.
2.  **Create `src/services/torrentService.ts`:**
    *   Initialize a singleton WebTorrent client.
    *   Implement `seedFile(file: File): Promise<string>` to start seeding a file and return its magnet URI.
    *   Implement `addTorrent(magnetUri: string): Promise<Torrent>` to join a swarm.
    *   Implement logic to manage active torrents and track peer counts.

### Phase 2: Post Creation Integration
3.  **Update `src/components/FeedComposer.tsx`:**
    *   Add a toggle/option to "Seed via BitTorrent" instead of (or in addition to) regular media server upload.
    *   When selected, use `torrentService.seedFile` to get a magnet link.
    *   Attach the magnet link to the Nostr event. Use NIP-94 style tags or a custom `magnet` tag.
4.  **Update `src/components/CommunityFeed.tsx`:**
    *   Mirror the `FeedComposer` changes for community-specific posts.

### Phase 3: Post Rendering and Playback
5.  **Create `src/components/TorrentMedia.tsx`:**
    *   A component that takes a magnet URI.
    *   Displays loading status, peer count, and progress.
    *   Once metadata is fetched, render the appropriate viewer (Image, Video player, or Audio player) using WebTorrent's streaming capabilities.
6.  **Update `src/components/Post.tsx`:**
    *   Implement logic to detect magnet links in event content or tags.
    *   Replace or supplement standard media rendering with the `TorrentMedia` component when a magnet link is present.

### Phase 4: Persistence and Background Seeding
7.  **Implement Seeding Manager:**
    *   Create a way to persist the list of files being seeded by the user (using `idb-keyval`).
    *   Restart seeding these files on app launch.
8.  **Service Worker Integration (Optional/Advanced):**
    *   Explore using the Service Worker to keep the WebTorrent client alive or handle requests even when the main UI is not active.

## Verification
*   Verify that files can be seeded and a magnet URI is generated.
*   Verify that another client (or another tab) can join the swarm using the magnet URI and download/stream the file.
*   Check peer count reporting in the UI.
*   Ensure zero TypeScript errors and lint warnings.
