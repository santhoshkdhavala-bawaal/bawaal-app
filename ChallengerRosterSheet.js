import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
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

/**
 * LATEST CHALLENGERS / queued roster sheet.
 * Host mode: CALL OUT jumps the auto-queue and launches a duel immediately.
 * Selecting VS (spectator) → parent enters dual 1v1 (Host | Rival).
 * Opens over live dual-focus; does not require leaving 1v1 first.
 */
export default function ChallengerRosterSheet({
  visible,
  host,
  challengers = [],
  activeRivalId,
  hostMode = false,
  queuedCount,
  onSelectRival,
  onCallOut,
  onViewGrid,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const count =
    typeof queuedCount === 'number' ? queuedCount : challengers.length;
  const title = hostMode
    ? `QUEUED ATHLETES (${count})`
    : 'LATEST CHALLENGERS';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.pullBar} />
          <Text style={styles.title}>{title}</Text>
          {hostMode ? (
            <Text style={styles.hostHint}>
              Tap CALL OUT to override the auto-queue and start a 1v1 duel.
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
            {challengers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No athletes waiting in queue</Text>
              </View>
            ) : (
              challengers.map((athlete, index) => {
                const active =
                  athlete.id === activeRivalId || athlete.handle === activeRivalId;
                const country =
                  athlete.label || athlete.country || athlete.handle || 'OPEN';
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
                    {hostMode ? (
                      <TouchableOpacity
                        style={[styles.callOutBtn, active && styles.callOutBtnDisabled]}
                        activeOpacity={0.85}
                        disabled={active}
                        onPress={() => onCallOut?.(athlete)}
                      >
                        <Text style={styles.callOutBtnText}>
                          {active ? 'LIVE' : 'CALL OUT'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.vsBtn}
                        activeOpacity={0.85}
                        onPress={() => onSelectRival?.(athlete)}
                      >
                        <Text style={styles.vsBtnText}>VS</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.gridBtn}
            activeOpacity={0.85}
            onPress={onViewGrid}
          >
            <Text style={styles.gridBtnText}>▦ BROWSE FULL GRID</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '72%',
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
