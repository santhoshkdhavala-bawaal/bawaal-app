/**
 * BattleChallengeForm — dedicated setup screen for ⚔️ BATTLE BAWAAL.
 * Collects title / sport / duration / schedule before launching the live arena.
 */
import React, { useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import CreateBattleSheet from './CreateBattleSheet';
import { pushHotFeatureBattle } from './battlesFeedStore';

type NavLike = {
  goBack?: () => void;
  canGoBack?: () => boolean;
  navigate?: (name: string, params?: Record<string, unknown>) => void;
  replace?: (name: string, params?: Record<string, unknown>) => void;
};

type Props = {
  navigation?: NavLike;
};

export default function BattleChallengeForm({ navigation }: Props) {
  const handleClose = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack?.();
    else navigation?.navigate?.('Main', { tab: 'Battles' });
  }, [navigation]);

  const handleLaunch = useCallback(
    (battle: Record<string, unknown>) => {
      const id = String(battle?.id || `live-bawaal-${Date.now()}`);
      const target = String(battle?.target || battle?.title || 'Live 1v1 Open Challenge');
      const liveMatch =
        (battle?.liveMatch as Record<string, unknown> | undefined) || undefined;

      pushHotFeatureBattle({
        id,
        challengeTitle: target,
        title: target,
        target,
        host: '@MUMBAI_STRIKER',
        hostFlag: '🇮🇳',
        hostLabel: 'INDIA',
        status: 'LIVE',
        isHotFeature: true,
        source: 'BATTLE_BAWAAL',
        liveMatch,
        sport: String(battle?.sport || 'GYM'),
      });

      const params = {
        mode: 'athlete',
        role: 'host',
        battleId: id,
        match: liveMatch || null,
        notifications: battle?.notifications,
        scheduledAtUTC: battle?.scheduledAtUTC,
      };

      if (typeof navigation?.replace === 'function') {
        navigation.replace('ChallengerArena', params);
      } else {
        navigation?.navigate?.('ChallengerArena', params);
      }
    },
    [navigation]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <CreateBattleSheet
        visible
        onClose={handleClose}
        onLaunch={handleLaunch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
});
