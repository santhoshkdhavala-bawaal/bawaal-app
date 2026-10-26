import { createContext, useContext } from 'react';

export const MainTabContext = createContext({
  tab: 'Arena',
  setTab: (_t) => {},
  openCreate: () => {},
  openProfileGateway: () => {},
  openSideDrawer: () => {},
  challengeAlertActive: false,
});

export function useMainTabs() {
  return useContext(MainTabContext);
}
