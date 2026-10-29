import { createContext, useContext } from 'react';

export const MainTabContext = createContext({
  tab: 'Arena',
  setTab: (_t) => {},
  openCreate: () => {},
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
