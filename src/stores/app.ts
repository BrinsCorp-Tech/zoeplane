// ZoePlane — minimal app-level Zustand store
// Story 1.1: provides the root Zustand store required by AC #2.
// Domain slices (theme, agent state, etc.) are added in later epics.

import { create } from "zustand";

interface AppState {
  /** Whether the app shell has fully initialised. */
  ready: boolean;
  setReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
