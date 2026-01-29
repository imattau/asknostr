# Plan to Simplify Codebase: Refactor App.tsx and Centralize Server State with React Query

## Goal
Simplify the codebase, improve readability, maintainability, and align with best practices by refactoring the "God Component" (`src/App.tsx`) and centralizing server-side data management using React Query.

## Current Issues Identified
- `src/App.tsx` acts as a "God Component", mixing UI layout, state management, and data fetching logic.
- `src/store/useStore.ts` (Zustand) is incorrectly used to manage server state (`events`), leading to an anti-pattern when React Query is already available and suitable.
- The event fetching logic in `App.tsx` is manual and can be prone to inconsistencies.

## Proposed Solution
Extract event fetching logic from `App.tsx` into a dedicated React Query hook. Decompose `App.tsx` into smaller, focused components. Migrate `events` management from Zustand to React Query.

## Discrete Tasks

### Phase 1: Establish React Query for Event Feed

1.  **Create `src/hooks/useFeed.ts` (new file):** - **[COMPLETED]**
    *   Develop a new custom React Query hook responsible for fetching and managing the main event feed.
    *   This hook should leverage `nostrService.subscribe` to fetch events.
    *   It should accept parameters for filtering and pagination if needed (e.g., `communityId`, `sortBy`).
    *   It should use `useQuery` or `useInfiniteQuery` (depending on pagination needs) to manage the `events` state, caching, and background updates.
    *   The structure of `src/hooks/useRelays.ts` can serve as a reference.

2.  **Remove `events` state from `src/store/useStore.ts`:** - **[COMPLETED]**
    *   Delete the `events` array and all related actions (e.g., `addEvent`, `addEvents`, `clearEvents`) from `useStore.ts`.
    *   Update any references to `events` from `useStore` to instead use the new `useFeed` hook.

3.  **Integrate `useFeed` into `src/App.tsx`:** - **[COMPLETED]**
    *   Replace the manual event fetching logic (`fetchEvents`) in `App.tsx` with calls to the new `useFeed` hook.
    *   Update `App.tsx` to consume `events` data directly from `useFeed`.

### Phase 2: Decompose `App.tsx`

4.  **Create `src/components/layouts/ClassicLayout.tsx` (new file):** - **[COMPLETED]**
    *   Move the JSX structure and logic for the "classic" layout (when `layout === 'classic'`) from `App.tsx` into this new component.
    *   This component will receive necessary props (e.g., `events`, `layers`, `pushLayer`, `popLayer`).

5.  **Create `src/components/layouts/SwipeLayout.tsx` (new file):** - **[COMPLETED]**
    *   Move the JSX structure and logic for the "swipe" layout (when `layout === 'swipe'`) from `App.tsx` into this new component.
    *   This component will receive necessary props.

6.  **Create `src/components/FeedComposer.tsx` (new file):** - **[COMPLETED]**
    *   Extract the event publishing form/logic currently residing within `App.tsx` (e.g., `handlePublish`, `postContent`, `isNsfw`) into a dedicated `FeedComposer` component.
    *   This component will handle its own state for composing new posts and interact with `nostrService` or a higher-level hook for publishing.

7.  **Refactor `App.tsx` to orchestrate layouts and data:** - **[COMPLETED]**
    *   `App.tsx` should now primarily focus on global state (from `useUiStore` and possibly `useStore` for user-specific data), routing (if any), and rendering the appropriate layout component (`ClassicLayout` or `SwipeLayout`).
    *   It should pass `events` (from `useFeed`) and other necessary props down to the layout components.
    *   Remove all UI-related JSX and state management that can be delegated to sub-components.
    *   **Progress:** Extracted `Header`, `SwipeLayout`, `ClassicLayout`, `FeedComposer`. `App.tsx` is now a high-level orchestrator. Cleaned up state and imports.

### Phase 3: Review and Refine

8.  **Review and Refine:** - **[COMPLETED]**
    *   Verified build integrity with `npm run build` (TypeScript compilation).
    *   Fixed type errors, missing props, and unused variables.
    *   Updated `useFeed` configuration for React Query v5 compatibility (`gcTime`).
    *   Refactored `CommunityFeed`, `ModQueue`, `ModerationLog`, `Sidebar`, `Thread`, `Post`, `CommunityAdmin`, `CommunityCreate` to rely on `useFeed` and `useQueryClient` instead of `useStore`.
    *   Restored logic in components that was temporarily broken during refactoring.
    *   Ensured zero build errors.

8.  **Review all modified files:**
    *   Ensure all previous functionality is retained.
    *   Check for any remaining anti-patterns or redundant code.
    *   Verify linting and TypeScript compliance (`npm run lint`, `npm run build`).
    *   Run tests (if available) to ensure stability.

This plan aims to significantly simplify `App.tsx`, improve modularity, and leverage the strengths of React Query for server state management.