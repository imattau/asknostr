# Implementation Plan: Fix Missing Posts in Community Feeds

## Phase 1: Diagnostic & Hook Refactoring
- [x] Task: debug: Inspect relay subscription filters and incoming event tags (74224f8)
    - [x] Add logging to 'useFeed.ts' (or relevant hook) to capture the exact filters sent to relays
    - [x] Log incoming Kind 1 events and their community tags to identify matching failures
- [x] Task: refactor: Correct community subscription filters (74224f8)
    - [x] Write tests for 'useCommunity' filter generation
    - [x] Ensure the 'a' tag filter is correctly formatted (e.g., '34550:pubkey:id')
- [x] Task: Conductor - User Manual Verification 'Phase 1: Diagnostic & Hook Refactoring' (Protocol in workflow.md)

## Phase 2: Client-side Filtering & Tag Stability
- [x] Task: fix: Implement robust community tag matching (0fd9181)
    - [ ] Write unit tests for community tag parsing logic in 'nostr-parsers.ts'
    - [ ] Fix logic to handle both long-form and short-form community identifiers
- [x] Task: fix: Ensure VirtualFeed displays filtered events correctly (0fd9181)
    - [ ] Verify that the state update from the feed hook triggers a re-render in 'VirtualFeed'
    - [ ] Add a regression test for community-specific event display
- [x] Task: Conductor - User Manual Verification 'Phase 2: Client-side Filtering - [ ] Task: Conductor - User Manual Verification 'Phase 2: Client-side Filtering & Tag Stability' Tag Stability' (Protocol in workflow.md)