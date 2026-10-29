import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import CustomTabBar from './CustomTabBar';
import ArenaFeed from './ArenaFeed';
import BattlesScreen from './BattlesScreen';
import LockerRoom from './LockerRoom';
import ProfileScreen from './ProfileScreen';
import ProfileGatewayModal from './ProfileGatewayModal';
import ChallengeAlertModal from './ChallengeAlertModal';
import CreateBattleSheet from './CreateBattleSheet';
import { pushOpenChallenge } from './arenaFeedStore';
import { pushBattleChallenge } from './battlesFeedStore';
import { MainTabContext } from './mainTabContext';

const EMPTY_CHALLENGE_DRAFT = {
  sport: 'COMBAT',
  title: '30-Sec Heavy Bag Combination',
  targetDetails: 'Jab-Cross-Hook-Upper · High Tempo',
  openerUri: null,
};

export { useMainTabs } from './mainTabContext';

const CHARCOAL = '#000000';

const DEMO_CHALLENGE = {
  id: 'alert-rival-1',
  handle: '@Rival_IN',
  sport: 'GYM',
  detail: '140 KG x 3 Reps · Beat the floor PR or forfeit street cred.',
  target: '140 KG x 3 Reps',
};

/**
 * 5-tab shell — only the active screen mounts in the stage.
 * ARENA · BATTLES · + BATTLE · LOCKER ROOM · PASSPORT
 */
export default function MainTabs({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(() => {
    const t = route?.params?.tab;
    if (t === 'LockerRoom') return 'Locker';
    if (t === 'Profile') return 'Passport';
    return t || 'Arena';
  });
  const [arenaRoute, setArenaRoute] = useState({
    key: 'arena',
    name: 'Arena',
    params: {
      newArenaPost: route?.params?.newArenaPost,
    },
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [focusHubId, setFocusHubId] = useState(null);
  const [challengeAlert, setChallengeAlert] = useState(DEMO_CHALLENGE);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [challengeDraft, setChallengeDraft] = useState(EMPTY_CHALLENGE_DRAFT);

  useEffect(() => {
    const nextTab = route?.params?.tab;
    if (nextTab) {
      setTab(
        nextTab === 'LockerRoom' ? 'Locker' : nextTab === 'Profile' ? 'Passport' : nextTab
      );
    }
    if (route?.params?.focusHubId) {
      setFocusHubId(String(route.params.focusHubId));
      setTab('Locker');
      navigation?.setParams?.({
        focusHubId: undefined,
        tab: undefined,
        joinSquadHint: undefined,
      });
    }
    if (route?.params?.newArenaPost) {
      setTab('Arena');
      // Keep a stable Arena key — remounting wiped the feed and flashed older clips
      setArenaRoute((prev) => ({
        key: prev?.key || 'arena',
        name: 'Arena',
        params: { newArenaPost: route.params.newArenaPost },
      }));
      navigation?.setParams?.({ newArenaPost: undefined, tab: undefined });
    }
    if (route?.params?.newBattlePost) {
      setTab('Battles');
      navigation?.setParams?.({ newBattlePost: undefined, tab: undefined });
    }
    // UniversalCamera Record Opener → reopen Create Arena Challenge with clip
    if (
      route?.params?.reopenCreateChallenge ||
      route?.params?.openerClipUri
    ) {
      const incomingDraft = route.params.createChallengeDraft || {};
      const openerUri =
        route.params.openerClipUri ||
        incomingDraft.openerUri ||
        null;
      setChallengeDraft({
        sport: incomingDraft.sport || 'COMBAT',
        title:
          incomingDraft.title ||
          incomingDraft.target ||
          EMPTY_CHALLENGE_DRAFT.title,
        targetDetails:
          incomingDraft.targetDetails ||
          incomingDraft.details ||
          EMPTY_CHALLENGE_DRAFT.targetDetails,
        openerUri,
      });
      setCreateChallengeOpen(true);
      setTab('Arena');
      navigation?.setParams?.({
        reopenCreateChallenge: undefined,
        openerClipUri: undefined,
        createChallengeDraft: undefined,
        tab: undefined,
      });
    }
  }, [
    route?.params?.tab,
    route?.params?.focusHubId,
    route?.params?.newArenaPost,
    route?.params?.newBattlePost,
    route?.params?.reopenCreateChallenge,
    route?.params?.openerClipUri,
    route?.params?.createChallengeDraft,
    navigation,
  ]);

  // Pre-warm camera/mic + preload camera bundle so FAB open feels instant
  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([
          Camera.requestCameraPermissionsAsync(),
          Camera.requestMicrophonePermissionsAsync(),
        ]);
      } catch (err) {
        console.warn('[MainTabs] camera prewarm failed:', err?.message || err);
      }
    })();
    // Warm the UniversalCamera JS module without navigating
    void import('./UniversalCamera').catch(() => {});
  }, []);

  /** Center + BATTLE FAB → Create Arena Challenge sheet. */
  const openCreate = useCallback(() => {
    setChallengeDraft(EMPTY_CHALLENGE_DRAFT);
    setCreateChallengeOpen(true);
  }, []);

  const openProfileGateway = useCallback(() => setProfileOpen(true), []);

  const clearFocusHub = useCallback(() => setFocusHubId(null), []);

  /** Passport Connected Squads → Locker Room hub (single-tap). */
  const openLockerHub = useCallback((hubOrId) => {
    const id =
      typeof hubOrId === 'string'
        ? hubOrId
        : hubOrId?.id != null
          ? String(hubOrId.id)
          : null;
    setFocusHubId(id);
    setTab('Locker');
  }, []);

  /** Record Opener → UniversalCamera / ChallengeCam, then return clip to sheet. */
  const onRecordOpener = useCallback(
    (draft) => {
      const next = {
        sport: draft?.sport || 'COMBAT',
        title: draft?.title || draft?.target || EMPTY_CHALLENGE_DRAFT.title,
        targetDetails:
          draft?.targetDetails || EMPTY_CHALLENGE_DRAFT.targetDetails,
        openerUri: draft?.openerUri || null,
      };
      setChallengeDraft(next);
      setCreateChallengeOpen(false);
      navigation?.navigate?.('UniversalCamera', {
        initialMode: 'SPARKS',
        captureOpenerOnly: true,
        challengeMaxDuration: 30,
        target: next.title || 'Arena Opener',
        createChallengeDraft: next,
      });
    },
    [navigation]
  );

  /** Publish OPEN challenge → Arena feed top + Battles OPEN list. */
  const onPublishOpenChallenge = useCallback((card) => {
    if (!card) return;
    const arenaCard = pushOpenChallenge(card) || card;
    pushBattleChallenge({
      ...card,
      status: 'OPEN',
      responses: 0,
      source: 'ARENA_CHALLENGE',
    });
    setChallengeDraft(EMPTY_CHALLENGE_DRAFT);
    setCreateChallengeOpen(false);
    setTab('Arena');
    setArenaRoute((prev) => ({
      key: prev?.key || 'arena',
      name: 'Arena',
      params: {
        newArenaPost: {
          ...arenaCard,
          type: 'battle_thread',
          isOpenChallenge: true,
          status: 'OPEN',
          challengerLabel: '@YOU',
          leaderLabel: 'OPEN',
          _freshPublish: true,
        },
      },
    }));
  }, []);

  /** Center FAB opens challenge sheet; thunder alerts live on the BATTLES tab. */
  const onCreatePress = useCallback(() => {
    openCreate();
  }, [openCreate]);

  const onTabPress = useCallback(
    (nextTab) => {
      setTab(nextTab);
      if (nextTab === 'Battles' && challengeAlert) {
        setChallengeModalOpen(true);
      }
    },
    [challengeAlert]
  );

  const acceptChallenge = useCallback(() => {
    const c = challengeAlert;
    setChallengeModalOpen(false);
    setChallengeAlert(null);
    navigation?.navigate?.('UniversalCamera', {
      initialMode: 'BATTLE_REWIND',
      battleId: c?.id,
      target: c?.target || c?.detail || 'OPEN CHALLENGE',
      handle: (c?.handle || '@Rival_IN').replace(/^@/, ''),
    });
  }, [challengeAlert, navigation]);

  const declineChallenge = useCallback(() => {
    setChallengeModalOpen(false);
    setChallengeAlert(null);
  }, []);

  const tabNavigation = useMemo(() => {
    const navigate = (name, params) => {
      if (name === 'Profile' || name === 'Passport') {
        setTab('Passport');
        return;
      }
      if (name === 'Arena' || name === 'Main') {
        setTab('Arena');
        if (params?.newArenaPost) {
          setArenaRoute({
            key: `arena-${Date.now()}`,
            name: 'Arena',
            params: { newArenaPost: params.newArenaPost },
          });
        }
        return;
      }
      if (name === 'Battles') {
        setTab('Battles');
        return;
      }
      if (name === 'Locker' || name === 'LockerRoom') {
        setTab('Locker');
        return;
      }
      navigation?.navigate?.(name, params);
    };

    return {
      navigate,
      goBack: (...args) => navigation?.goBack?.(...args),
      canGoBack: () => Boolean(navigation?.canGoBack?.()),
      reset: (...args) => navigation?.reset?.(...args),
      dispatch: (...args) => navigation?.dispatch?.(...args),
      getParent: () => navigation?.getParent?.(),
      setParams: (p) => {
        setArenaRoute((prev) => ({
          ...prev,
          params: { ...(prev?.params || {}), ...p },
        }));
      },
      addListener: (...args) => navigation?.addListener?.(...args),
      removeListener: (...args) => navigation?.removeListener?.(...args),
      isFocused: () => navigation?.isFocused?.() ?? true,
    };
  }, [navigation]);

  const challengeAlertActive = Boolean(challengeAlert);
  const ctx = useMemo(
    () => ({
      tab,
      setTab,
      openCreate,
      openProfileGateway,
      openLockerHub,
      focusHubId,
      clearFocusHub,
      challengeAlertActive,
    }),
    [
      tab,
      openCreate,
      openProfileGateway,
      openLockerHub,
      focusHubId,
      clearFocusHub,
      challengeAlertActive,
    ]
  );
  // Clear Android 3-button / iOS home-indicator — never let tabs collide with system nav
  const systemFloor = Platform.OS === 'android' ? 24 : 12;
  const bottomPad = Math.max(insets.bottom, systemFloor) + (Platform.OS === 'android' ? 12 : 8);

  let ActiveScreen = null;
  if (tab === 'Arena') {
    ActiveScreen = <ArenaFeed navigation={tabNavigation} route={arenaRoute} />;
  } else if (tab === 'Battles') {
    ActiveScreen = <BattlesScreen navigation={tabNavigation} />;
  } else if (tab === 'Locker') {
    ActiveScreen = <LockerRoom navigation={tabNavigation} />;
  } else if (tab === 'Passport') {
    ActiveScreen = <ProfileScreen navigation={tabNavigation} />;
  }

  return (
    <MainTabContext.Provider value={ctx}>
      <View style={styles.root}>
        <View style={styles.stage}>{ActiveScreen}</View>
        <CustomTabBar
          activeTab={tab}
          onTabPress={onTabPress}
          onCreatePress={onCreatePress}
          bottomPad={bottomPad}
          challengeAlertActive={challengeAlertActive}
        />
        <ProfileGatewayModal
          visible={profileOpen}
          onClose={() => setProfileOpen(false)}
          onOpenPassport={() => setTab('Passport')}
          onOpenSportHubMap={() => {
            setProfileOpen(false);
            navigation?.navigate?.('SportHubMap');
          }}
        />
        <ChallengeAlertModal
          visible={challengeModalOpen}
          challenge={challengeAlert}
          onAccept={acceptChallenge}
          onDecline={declineChallenge}
          onClose={() => setChallengeModalOpen(false)}
        />
        <CreateBattleSheet
          visible={createChallengeOpen}
          intent="openChallenge"
          draft={challengeDraft}
          onClose={() => {
            setCreateChallengeOpen(false);
            setChallengeDraft(EMPTY_CHALLENGE_DRAFT);
          }}
          onRecordOpener={onRecordOpener}
          onPublishOpen={onPublishOpenChallenge}
        />
      </View>
    </MainTabContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHARCOAL,
  },
  stage: {
    flex: 1,
    backgroundColor: CHARCOAL,
  },
});
