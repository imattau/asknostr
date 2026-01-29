# BitTorrent Storage Integration Plan (Revised: Social Swarm & Bridge Orchestration)

## Goal
Enable decentralized, community-driven storage and retrieval of Nostr media. This system leverages the Nostr social graph to automatically seed content among followers and uses a temporary "Bridge Server" to ensure data availability until a healthy swarm is established.

---

## Discrete Tasks

### Phase 1: Infrastructure & Swarm Orchestration
1.  **Add Dependencies:** - **[COMPLETED]**
    *   Install `webtorrent` and `buffer`.
2.  **Implement `SwarmOrchestrator` in `torrentService.ts`:**
    *   **Follower-Seed Listener:** Monitor incoming Nostr events from followed users. If an event contains a magnet link, automatically trigger `addTorrent()` to join the swarm.
    *   **Storage Quotas:** Implement logic to manage the `idb-keyval` storage. Auto-prune the oldest/least-relevant torrents when local browser storage hits a user-defined limit (e.g., 500MB).
    *   **Swarm Health Reporting:** Implement a heartbeat that reports the current seeder count for active infoHashes to the Bridge Server.

### Phase 2: Post Creation (The "Server Bridge" Handoff)
3.  **Dual-Action Upload in `FeedComposer.tsx` & `CommunityFeed.tsx`:**
    *   When "Seed via BitTorrent" is selected, perform two actions simultaneously:
        1.  **Local Seed:** Initialize WebTorrent seeding in the browser.
        2.  **Safety Net:** Upload the file to the **Temporary Bridge Server** via standard HTTP POST.
4.  **NIP-94 Metadata Alignment:**
    *   Ensure the published Nostr event includes both the `magnet` tag (for P2P) and the `url` tag (for the server fallback/handoff).

### Phase 3: The Bridge Server (The "Catalyst")
5.  **Create `torrent-bridge-service` (Node.js/External):**
    *   **Auto-Seeder:** Use `webtorrent-hybrid` to automatically join every swarm created by users via the Bridge API.
    *   **Retention Policy Logic:** Implement a cron job to monitor swarm health.
    *   **The "Handoff" Trigger:** If `activeSeeders > X` (e.g., 10) AND `timeSinceUpload > 24h`, delete the local file from the server's disk, leaving the social swarm to handle delivery.

### Phase 4: Persistence, UX & Social Prioritization
6.  **Seeding Manager Enhancements:**
    *   **Social Prioritization:** Prioritize background re-seeding for files from "Favorites" or "Zapped" creators stored in IndexedDB.
7.  **Community UI/UX:**
    *   **"Seeding for [User]" Status:** Add a UI indicator (e.g., a purple pulsing dot) on posts to show the user is actively helping host that creator's media.
    *   **Global Health Bar:** Create a dashboard showing "Total Space Contributed" to the AskNostr network.
8.  **Torrent Media Viewer:** - **[COMPLETED]**
    *   Component to stream images, videos, and audio directly from the BitTorrent swarm with real-time peer reporting.

---

### Revised Flow Summary

| Layer | Responsibility |
| --- | --- |
| **Uploader PWA** | Creates magnet, uploads to Bridge, seeds while tab is open. |
| **Bridge Server** | Holds 100% of data initially; acts as a persistent peer until the social swarm is healthy. |
| **Follower PWA** | Sees the note, checks "Auto-seed follows" setting, starts downloading/seeding in the background. |
| **Pruning Engine** | Server deletes its copy once the community "clones" the data successfully. |

---

## Verification
*   Verify Dual-Action upload (Magnet generated + Server URL received).
*   Verify Follower-Seed trigger (Tab B starts seeding Tab A's post automatically).
*   Verify Storage Quota enforcement (Adding 600MB of data prunes the oldest 100MB).
*   Ensure zero TypeScript errors and lint warnings.