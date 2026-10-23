import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#0A0A0A';
const SURFACE = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ORANGE = '#FF5722';
const CYAN = '#00E5FF';
const BORDER = '#1F2937';
const CALL_OUT = '#FFE600';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 8;
const TILE_W = (SCREEN_W - 32 - GRID_GAP * 2) / 3;

/**
 * Slide-up challenger roster — mounts over live A/V without tearing streams.
 * Host: CALL OUT · Spectator: SPECTATE / UP NEXT · Athlete: VS
 */
export default function ChallengerRosterSheet({
  visible,
  host,
  challengers = [],
  activeRivalId,
  hostMode = false,
  spectatorMode = false,
  queuedCount,
  nextUpId,
  onSelectRival,
  onSpectate,
  onCallOut,
  onViewGrid,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const [gridMode, setGridMode] = useState(false);
  const count =
    typeof queuedCount === 'number' ? queuedCount : challengers.length;
  const title = hostMode
    ? `QUEUED ATHLETES (${count})`
    : spectatorMode
      ? `CHALLENGERS IN QUEUE (${count})`
      : 'LATEST CHALLENGERS';

  const closeSheet = () => {
    setGridMode(false);
    onClose?.();
  };

  const gridAthletes = (() => {
    const base = (challengers.length ? challengers : []).slice(0, 9);
    if (!base.length) return base;
    const filled = [...base];
    while (filled.length < 9) {
      filled.push(base[filled.length % base.length]);
    }
    return filled;
  })();

  const isActive = (athlete) =>
    athlete?.id === activeRivalId || athlete?.handle === activeRivalId;

  const isNextUp = (athlete, index) => {
    if (nextUpId != null) {
      return athlete?.id === nextUpId || athlete?.handle === nextUpId;
    }
    return index === 0 && !isActive(athlete);
  };

  const pickAthlete = (athlete) => {
    if (hostMode) {
      onCallOut?.(athlete);
      return;
    }
    if (spectatorMode) {
      if (onSpectate) onSpectate(athlete);
      else onSelectRival?.(athlete);
      return;
    }
    onSelectRival?.(athlete);
  };

  const actionLabel = (athlete, index) => {
    if (hostMode) return isActive(athlete) ? 'LIVE' : 'CALL OUT';
    if (spectatorMode) {
      if (isActive(athlete)) return 'WATCHING';
      if (isNextUp(athlete, index)) return 'UP NEXT';
      return 'SPECTATE';
    }
    return isActive(athlete) ? 'LIVE' : 'VS';
  };

  const renderActionButton = (athlete, index) => {
    const active = isActive(athlete);
    const next = isNextUp(athlete, index);
    const label = actionLabel(athlete, index);

    if (hostMode) {
      return (
        <TouchableOpacity
          style={[styles.callOutBtn, active && styles.callOutBtnDisabled]}
          activeOpacity={0.85}
          disabled={active}
          onPress={() => onCallOut?.(athlete)}
        >
          <Text style={styles.callOutBtnText}>{label}</Text>
        </TouchableOpacity>
      );
    }

    if (spectatorMode) {
      return (
        <View style={styles.spectatorActions}>
          {next && !active ? (
            <View style={styles.upNextBadge}>
              <Text style={styles.upNextBadgeText}>UP NEXT</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.spectateBtn,
              active && styles.spectateBtnActive,
              next && !active && styles.spectateBtnNext,
            ]}
            activeOpacity={0.85}
            disabled={active}
            onPress={() => pickAthlete(athlete)}
          >
            <Text style={styles.spectateBtnText}>
              {active ? 'WATCHING' : 'SPECTATE'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.vsBtn}
        activeOpacity={0.85}
        onPress={() => onSelectRival?.(athlete)}
      >
        <Text style={styles.vsBtnText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.pullBar} />
          <Text style={styles.title}>{title}</Text>
          {hostMode ? (
            <Text style={styles.hostHint}>
              Tap CALL OUT to override the auto-queue and start a 1v1 duel.
            </Text>
          ) : null}
          {spectatorMode ? (
            <Text style={styles.hostHint}>
              Tap SPECTATE to switch the bottom rival feed — live stream stays on.
            </Text>
          ) : null}

          {host ? (
            <View style={styles.hostCard}>
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>[H]</Text>
              </View>
              <Text style={styles.hostFlag}>{host.flag || '🇮🇳'}</Text>
              <View style={styles.hostMeta}>
                <Text style={styles.hostHandle} numberOfLines={1}>
                  {host.handle || '@HOST'}
                </Text>
                <Text style={styles.hostSub}>
                  {host.label || host.country || 'INDIA'} · {host.reps ?? 0} REPS
                </Text>
              </View>
            </View>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {gridMode ? (
              <View style={styles.grid}>
                {gridAthletes.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No athletes waiting in queue</Text>
                  </View>
                ) : (
                  gridAthletes.map((athlete, index) => {
                    const active = isActive(athlete);
                    const next = isNextUp(athlete, index);
                    return (
                      <TouchableOpacity
                        key={`${athlete.id || athlete.handle || 'tile'}-${index}`}
                        style={[
                          styles.tile,
                          active && styles.tileActive,
                          next && !active && styles.tileNext,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => pickAthlete(athlete)}
                      >
                        {next && !active ? (
                          <View style={styles.tileUpNext}>
                            <Text style={styles.tileUpNextText}>UP NEXT</Text>
                          </View>
                        ) : null}
                        <Text style={styles.tileFlag}>{athlete.flag || '🌐'}</Text>
                        <Text style={styles.tileHandle} numberOfLines={1}>
                          {athlete.handle || '@CONTENDER'}
                        </Text>
                        <Text style={styles.tileMeta} numberOfLines={1}>
                          {athlete.label || athlete.country || 'OPEN'}
                        </Text>
                        <Text style={styles.tileReps}>{athlete.reps ?? 0} REPS</Text>
                        <Text style={styles.tileAction}>
                          {spectatorMode
                            ? active
                              ? 'WATCHING'
                              : 'SPECTATE'
                            : actionLabel(athlete, index)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ) : challengers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No athletes waiting in queue</Text>
              </View>
            ) : (
              challengers.map((athlete, index) => {
                const active = isActive(athlete);
                const country =
                  athlete.label || athlete.country || 'OPEN';
                return (
                  <View
                    key={athlete.id || athlete.handle || `q-${index}`}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <Text style={styles.queuePos}>#{index + 1}</Text>
                    <Text style={styles.rowFlag}>{athlete.flag || '🌐'}</Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowHandle} numberOfLines={1}>
                        {country} {athlete.flag || ''}
                      </Text>
                      <Text style={styles.rowStats} numberOfLines={1}>
                        {athlete.handle || '@CONTENDER'} · {athlete.reps ?? 0}{' '}
                        REPS
                      </Text>
                    </View>
                    {renderActionButton(athlete, index)}
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.gridBtn}
            activeOpacity={0.85}
            onPress={() => {
              setGridMode((prev) => !prev);
              onViewGrid?.();
            }}
          >
            <Text style={styles.gridBtnText}>
              {gridMode ? '☰ SHOW QUEUE LIST' : '▦ BROWSE FULL GRID'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pullBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginBottom: 12,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  hostHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 15,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  hostBadge: {
    backgroundColor: '#FFE600',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hostBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  hostFlag: { fontSize: 18 },
  hostMeta: { flex: 1, minWidth: 0 },
  hostHandle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },
  hostSub: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 8, gap: 8 },
  emptyCard: {
    flex: 1,
    minWidth: '100%',
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W,
    minHeight: TILE_W * 1.05,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tileActive: {
    borderColor: CYAN,
  },
  tileNext: {
    borderColor: CALL_OUT,
  },
  tileUpNext: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: CALL_OUT,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tileUpNextText: {
    color: '#000000',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tileFlag: { fontSize: 22 },
  tileHandle: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    maxWidth: '100%',
  },
  tileMeta: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileReps: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  tileAction: {
    color: ORANGE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowActive: {
    borderColor: CYAN,
  },
  queuePos: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    width: 22,
  },
  rowFlag: { fontSize: 18 },
  rowMeta: { flex: 1, minWidth: 0 },
  rowHandle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },
  rowStats: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  spectatorActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  upNextBadge: {
    backgroundColor: CALL_OUT,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  upNextBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  spectateBtn: {
    backgroundColor: CYAN,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  spectateBtnNext: {
    backgroundColor: CALL_OUT,
  },
  spectateBtnActive: {
    backgroundColor: 'rgba(0,229,255,0.35)',
  },
  spectateBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  vsBtn: {
    backgroundColor: CYAN,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  vsBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  callOutBtn: {
    backgroundColor: CALL_OUT,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  callOutBtnDisabled: {
    backgroundColor: 'rgba(0,229,255,0.35)',
  },
  callOutBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  gridBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,87,34,0.12)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  gridBtnText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
