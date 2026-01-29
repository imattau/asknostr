# BitTorrent Storage Integration Plan (Revised: Hybrid Social Swarm & Bridge Orchestration)

## Goal
Enable decentralized, community-driven storage and retrieval of Nostr media. This system leverages the Nostr social graph to automatically seed content among followers, prefers user-configured media servers for persistent hosting, and uses a "Bridge Server" as a bootstrap catalyst and safety net.

---

## Discrete Tasks

### Phase 1: Infrastructure & Swarm Orchestration
1.  **Add Dependencies:** - **[COMPLETED]**
    *   Install `webtorrent` and `buffer`.
2.  **Implement `SwarmOrchestrator` in `torrentService.ts`:** - **[COMPLETED]**
    *   **Follower-Seed Listener:** Monitor incoming Nostr events from followed users. If an event contains a magnet link, automatically trigger `addTorrent()` to join the swarm.
    *   **Storage Quotas:** Implement logic to manage the `idb-keyval` storage. Auto-prune the oldest/least-relevant torrents when local browser storage hits a user-defined limit (e.g., 500MB).
    *   **Swarm Health Reporting:** Implement a heartbeat that reports the current seeder count for active infoHashes to the Bridge Server.

### Phase 2: Post Creation (Hybrid Storage & Handoff)
3.  **Intelligent Dual-Action Upload in `FeedComposer.tsx` & `CommunityFeed.tsx`:**
    *   **getStorageProvider() Helper:** Implement a helper that checks user settings for configured Nostr Media Servers (Blossom/NIP-96).
    *   **Storage Hierarchy:** 
        1.  Attempt upload to the user's **Preferred Media Server**.
        2.  Fallback to the **AskNostr Bridge Server** if no preference is set or upload fails.
    *   **Local Seed:** Simultaneously initialize WebTorrent seeding in the browser.
3.1. **WebTorrent Bootstrap Ping:**
    *   Once the HTTP upload is complete, the client pings the Bridge Server with the URL and Magnet link so the bridge can begin seeding from the HTTP source immediately.
4.  **NIP-94 Metadata Alignment:**
    *   Ensure the published Nostr event includes the following tags:
        *   `i`: infoHash
        *   `magnet`: magnet URI
        *   `url`: The persistent HTTP link from the media server.

### Phase 3: The Bridge Server (The "Catalyst")
5.  **Create `torrent-bridge-service` (Node.js/External):**
    *   **Seeder-Leecher Discovery:**
        *   **If file is on Private Server:** Bridge downloads via HTTP, seeds as a WebRTC peer to bootstrap the swarm, then deletes local copy once social health threshold is met.
        *   **If file is on Bridge:** Keep file on disk as primary seed until community swarm is healthy.
    *   **Retention Policy Logic:** Implement a cron job to monitor swarm health via PWA heartbeats.
    *   **The "Handoff" Trigger:** If `activeSeeders > X` (e.g., 10) AND `timeSinceUpload > 24h`, delete local file from disk.

### Phase 4: Persistence, UX & Social Prioritization
6.  **Seeding Manager Enhancements:**
    *   **Social Prioritization:** Prioritize background re-seeding for files from "Favorites" or "Zapped" creators stored in IndexedDB.
7.  **Community UI/UX:** - **[COMPLETED]**
    *   **"Seeding for [User]" Status:** UI indicator (purple pulsing dot) on posts where the user is an active peer.
    *   **Global Health Bar:** Dashboard in sidebar showing total space contributed.
8.  **Torrent Media Viewer:** - **[COMPLETED]**
    *   Component to stream media from BitTorrent swarms.

### Phase 5: Dynamic Fallback UI
9.  **Race Condition Logic in `TorrentMedia.tsx`:**
    *   Attempt P2P fetch first.
    *   **The 5-Second Rule:** If peer count is 0 and download hasn't started after 5s, automatically "fall back" to the standard HTTP `url` tag to ensure immediate playback.
    *   **Background Promotion:** If watching via HTTP, the PWA should still join the swarm in the background and begin seeding the downloaded chunks to help others.

---

### Revised Flow Summary

| Layer | Responsibility |
| --- | --- |
| **Uploader PWA** | Creates magnet, uploads to Preferred/Bridge server, seeds while tab is open. |
| **Bridge Server** | Bootstraps swarm from HTTP source; acts as persistent seed until communauté takes over. |
| **Follower PWA** | Joins swarm automatically for followed users; contributes to social storage layer. |
| **Fallback UI** | Ensures zero-wait playback via HTTP if P2P swarm is cold, while promoting swarm health. |

---

## Verification
*   Verify storage hierarchy (uses Blossom if available).
*   Verify Bootstrap ping (Bridge starts seeding immediately from new HTTP URL).
*   Verify 5s Fallback (Media plays via URL when no peers are present).
*   Ensure zero TypeScript errors and lint warnings.
