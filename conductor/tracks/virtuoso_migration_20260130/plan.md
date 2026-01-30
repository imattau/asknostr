# Implementation Plan: Migrating Feeds to React Virtuoso

## Phase 1: Installation & Scaffolding
- [x] Task: chore: Install 'react-virtuoso' and remove legacy virtualization dependencies (266031c)
    - [x] `npm install react-virtuoso`
    - [x] `npm uninstall react-window react-virtualized-auto-sizer`
- [x] Task: refactor: Create basic Virtuoso structure in 'VirtualFeed.tsx' (118eed4)
    - [x] Remove 'AutoSizer', 'List' (react-window), and 'Fallback_Render_Mode' (manual .map)
    - [x] Implement 'Virtuoso' component with dynamic item rendering
- [x] Task: Conductor - User Manual Verification 'Phase 1: Installation & Scaffolding' (Protocol in workflow.md)

## Phase 2: Core Migration & Refinement
- [ ] Task: feat: Implement dynamic height support and infinite scroll
    - [ ] Remove manual height measurement hooks and logic
    - [ ] Wire up 'onLoadMore' to 'endReached' prop
- [ ] Task: fix: Stabilize Virtuoso container and scroll sync
    - [ ] Ensure 'VirtualFeed' fills its parent container correctly without 'AutoSizer'
    - [ ] Audit scroll callbacks for header hiding logic
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Migration & Refinement' (Protocol in workflow.md)

## Phase 3: Cleanup & Optimization
- [ ] Task: refactor: Optimize initial data fetch priority and concurrency
    - [ ] Implement priority levels in `nostrService.subscribe` (Feed > Metadata)
    - [ ] Increase `maxActiveRelays` and refine queue processing burst logic
- [ ] Task: chore: Remove diagnostic logs and debug markers
    - [ ] Clean up console logs in 'App.tsx' and 'VirtualFeed.tsx'
    - [ ] Remove orange/green/blue debug colors
- [ ] Task: test: Verify feed stability across all layouts
    - [ ] Test desktop column view and mobile swipe stack
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Cleanup & Optimization' (Protocol in workflow.md)