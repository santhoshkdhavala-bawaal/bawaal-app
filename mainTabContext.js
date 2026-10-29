import { createContext, useContext } from 'react';

export const MainTabContext = createContext({
  tab: 'Arena',
  setTab: (_t) => {},
  /** Open Create Arena Challenge sheet (optional draft: sport / title / targetDetails). */
  openCreate: (_draft) => {},
  /** Alias — Battles "LAUNCH ARENA CHALLENGE" entry point. */
  openArenaChallenge: (_draft) => {},
  openProfileGateway: () => {},
  /** Open Locker Room and surface a specific training hub (from Passport). */
  openLockerHub: (_hubOrId) => {},
  focusHubId: null,
  clearFocusHub: () => {},
  challengeAlertActive: false,
});

export function useMainTabs() {
  return useContext(MainTabContext);
}
