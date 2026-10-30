import { createContext, useContext } from 'react';

export const MainTabContext = createContext({
  tab: 'Arena',
  setTab: (_t) => {},
  /** 1-tap → UniversalCamera Arena Open Challenge (optional draft). */
  openCreate: (_draft) => {},
  /** Battles "LAUNCH ARENA CHALLENGE" — same 1-tap camera path. */
  openArenaChallenge: (_draft) => {},
  openProfileGateway: () => {},
  /** Open Locker Room and surface a specific training hub (from Passport). */
  openLockerHub: (_hubOrId) => {},
  /** Arena shelf → BATTLES Open Callouts focused on a challenge id. */
  openBattlesCallout: (_challengeId) => {},
  focusHubId: null,
  clearFocusHub: () => {},
  focusChallengeId: null,
  clearFocusChallenge: () => {},
  challengeAlertActive: false,
});

export function useMainTabs() {
  return useContext(MainTabContext);
}
