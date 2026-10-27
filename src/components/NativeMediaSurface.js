/**
 * Modular JS fallback wrapper for native media.
 *
 * Usage:
 *   import NativeMediaSurface from './src/components/NativeMediaSurface';
 *
 *   <NativeMediaSurface
 *     mode="feed"
 *     sport="CRICKET"
 *     label="OPENER"
 *     uri={clipUri}
 *   />
 *
 *   // Screen-level gate (AthleteDashboard / BattleScreen / etc.)
 *   <NativeMediaSurface.Gate feature="agora" screenName="BattleScreen">
 *     <YourLiveLayout />
 *   </NativeMediaSurface.Gate>
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  isExpoGo,
  canUseNativeVideo,
  canUseAgora,
  getRuntimeLabel,
} from '../utils/runtimeEnv';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';
import SafeFeedVideo from './SafeFeedVideo';
import { COLORS } from '../../theme';

/**
 * Feed / clip surface — Expo Go → placeholder; native build → SafeFeedVideo.
 */
function NativeMediaSurface({
  mode = 'feed',
  uri,
  source,
  sport,
  label,
  handle,
  muted = true,
  paused = false,
  loop = true,
  autoPlay = true,
  contentFit = 'cover',
  style,
  seed = 0,
  forcePlaceholder = false,
}) {
  if (mode === 'live' || mode === 'battle') {
    return (
      <SportsFeedPlaceholder
        style={style}
        sport={sport}
        label={label || (mode === 'battle' ? 'BATTLE PREVIEW' : 'LIVE PREVIEW')}
        handle={handle}
        variant={mode === 'battle' ? 'battle' : 'live'}
        seed={seed}
        showExpoBadge={forcePlaceholder || isExpoGo || !canUseAgora}
      />
    );
  }

  if (forcePlaceholder) {
    return (
      <SportsFeedPlaceholder
        style={style}
        sport={sport}
        label={label}
        handle={handle}
        variant="feed"
        seed={seed}
      />
    );
  }

  // SafeFeedVideo already swaps to SportsFeedPlaceholder inside Expo Go
  return (
    <SafeFeedVideo
      uri={uri}
      source={source}
      style={style}
      muted={muted}
      paused={paused}
      loop={loop}
      autoPlay={autoPlay}
      contentFit={contentFit}
      label={label}
      sport={sport}
    />
  );
}

/**
 * Soft gate for screens that need native modules.
 * Children always render (so you can style / navigate). Banner only in Expo Go.
 */
function NativeMediaGate({
  feature = 'native',
  screenName = 'Screen',
  children,
  showBanner = true,
}) {
  const blocked =
    (feature === 'agora' && !canUseAgora) ||
    (feature === 'video' && !canUseNativeVideo) ||
    (feature === 'native' && isExpoGo);

  return (
    <View style={styles.gateRoot}>
      {blocked && showBanner ? (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.bannerTitle}>
            {screenName.toUpperCase()} · {getRuntimeLabel().toUpperCase()}
          </Text>
          <Text style={styles.bannerBody}>
            Native {feature} stubbed — layout & navigation stay live.
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

NativeMediaSurface.Gate = NativeMediaGate;
NativeMediaSurface.Placeholder = SportsFeedPlaceholder;
NativeMediaSurface.isExpoGo = isExpoGo;
NativeMediaSurface.canUseNativeVideo = canUseNativeVideo;
NativeMediaSurface.canUseAgora = canUseAgora;

export { NativeMediaGate, SportsFeedPlaceholder };
export default memo(NativeMediaSurface);

const styles = StyleSheet.create({
  gateRoot: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  banner: {
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerTitle: {
    color: COLORS.ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  bannerBody: {
    marginTop: 4,
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
  },
});
