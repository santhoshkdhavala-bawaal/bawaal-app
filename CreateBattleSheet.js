import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLiveBattle, newBattleId } from './src/services/battleSyncService';

const BG = '#0A0A0A';
const SURFACE = '#121212';
const BORDER = '#1F2937';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const OFF_WHITE = '#E8ECE9';

const SPORTS = ['COMBAT', 'GYM', 'CRICKET', 'ATHLETICS', 'CROSSFIT'];
const PRESETS = [
  '3-Round Shadow Spar',
  '100 Pushups Sprint',
  'Max Bench 3 Reps',
  'Cover Drive · 6 Balls',
];
const DURATIONS = [
  { id: '1m', label: '1 Min', seconds: 60 },
  { id: '3m', label: '3 Min', seconds: 180 },
  { id: '5m', label: '5 Min', seconds: 300 },
  { id: 'reps', label: 'Custom Rep Goal', seconds: 180 },
];

const HOST_HANDLE = '@MUMBAI_STRIKER';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Starts now';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `Starts in ${pad2(h)}h ${pad2(m)}m`;
}

function formatLocalSchedule(isoUTC) {
  try {
    const d = new Date(isoUTC);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return isoUTC;
  }
}

/**
 * Create Battle bottom sheet — UTC scheduling + notification payload schema.
 *
 * Minimalist B&W: transparent pills, white borders, selected rgba(255,255,255,0.2).
 */
export default function CreateBattleSheet({ visible, onClose, onLaunch }) {
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState('COMBAT');
  const [title, setTitle] = useState('3-Round Shadow Spar');
  const [battleType, setBattleType] = useState('open'); // open | direct
  const [rivalHandle, setRivalHandle] = useState('@NYC_LIFT');
  const [durationId, setDurationId] = useState('3m');
  const [scheduleMode, setScheduleMode] = useState('now'); // now | later
  const [laterOffsetMin, setLaterOffsetMin] = useState(135); // 2h 15m demo
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setSport('COMBAT');
    setTitle('3-Round Shadow Spar');
    setBattleType('open');
    setRivalHandle('@NYC_LIFT');
    setDurationId('3m');
    setScheduleMode('now');
    setLaterOffsetMin(135);
  }, [visible]);

  const duration = DURATIONS.find((d) => d.id === durationId) || DURATIONS[1];

  const scheduledAtUTC = useMemo(() => {
    const base = new Date();
    if (scheduleMode === 'later') {
      base.setMinutes(base.getMinutes() + laterOffsetMin);
    }
    return base.toISOString();
  }, [scheduleMode, laterOffsetMin, tick]);

  const countdownLabel = useMemo(() => {
    if (scheduleMode === 'now') return 'Goes LIVE immediately';
    return formatCountdown(new Date(scheduledAtUTC).getTime() - Date.now());
  }, [scheduleMode, scheduledAtUTC, tick]);

  const localScheduleLabel = useMemo(
    () => formatLocalSchedule(scheduledAtUTC),
    [scheduledAtUTC]
  );

  const buildPayload = () => {
    const battleId = newBattleId();
    const rival =
      battleType === 'direct'
        ? rivalHandle.startsWith('@')
          ? rivalHandle
          : `@${rivalHandle.replace(/^@/, '')}`
        : '@OPEN_FIELD';
    const challengeTitle = title.trim() || 'OPEN CHALLENGE';
    const mins = Math.max(1, Math.round(duration.seconds / 60));
    const rivalUserId =
      battleType === 'direct'
        ? rival.replace(/^@/, '').toLowerCase()
        : 'open-field';

    return {
      id: battleId,
      sport,
      target: challengeTitle,
      description: null,
      host: HOST_HANDLE,
      rival,
      responses: 0,
      status: scheduleMode === 'now' ? 'LIVE' : 'SCHEDULED',
      battleType,
      durationSec: duration.seconds,
      scheduledAtUTC,
      notifications: {
        direct_push:
          battleType === 'direct'
            ? {
                type: 'direct_push',
                priority: 'high',
                to: rival,
                title: 'BAWAAL Direct Callout',
                body: `${HOST_HANDLE} challenged you: ${challengeTitle}! Tap to Accept.`,
                data: { battleId, sport, scheduledAtUTC },
              }
            : null,
        hype_broadcast: {
          type: 'hype_broadcast',
          channel: 'followers',
          title: 'BAWAAL Going Live',
          body: `${HOST_HANDLE} is live — ${challengeTitle} [${sport}]`,
          data: { battleId, sport, scheduledAtUTC, goLiveAt: scheduledAtUTC },
        },
      },
      liveMatch: {
        id: battleId,
        battleId,
        category: `[${sport}] ${challengeTitle.toUpperCase()}`,
        timerLabel: `${pad2(mins)}:00`,
        spectatorsLabel: '0 LIVE',
        host: {
          id: 'host-mumbai',
          handle: HOST_HANDLE,
          flag: '🇮🇳',
          label: 'INDIA',
          reps: 0,
        },
        challenger: {
          id: rivalUserId,
          userId: rivalUserId,
          handle: battleType === 'direct' ? rival : '@OPEN_FIELD',
          flag: battleType === 'direct' ? '🇺🇸' : '🌐',
          label: battleType === 'direct' ? 'USA' : 'OPEN',
          reps: 0,
          votes: 0,
        },
        initialHostVotes: 1,
        initialChallengerVotes: 1,
        initialHype: 0,
      },
    };
  };

  const launch = async () => {
    const battle = buildPayload();
    await createLiveBattle({
      id: battle.id,
      hostId: 'host-mumbai',
      hostUsername: HOST_HANDLE,
      hostFlag: '🇮🇳',
      title: battle.target,
      category: battle.sport,
      matchLength: `${battle.durationSec}s`,
      status: scheduleMode === 'now' ? 'live' : 'scheduled',
      challenger:
        battleType === 'direct'
          ? {
              userId: battle.liveMatch.challenger.userId,
              username: battle.liveMatch.challenger.handle,
              flag: battle.liveMatch.challenger.flag,
              reps: 0,
              votes: 0,
            }
          : null,
    });
    onClose?.();
    onLaunch?.(battle);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.accentLine} />
          <View style={styles.pullBar} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>CREATE A BAWAAL BATTLE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <Text style={styles.label}>SPORT CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {SPORTS.map((s) => {
                const active = sport === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSport(s)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>CHALLENGE TITLE</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Name your battle"
              placeholderTextColor="#666"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.presetChip}
                  onPress={() => setTitle(p)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.presetChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>BATTLE TYPE</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentBtn, battleType === 'open' && styles.segmentBtnOn]}
                onPress={() => setBattleType('open')}
              >
                <Text
                  style={[styles.segmentText, battleType === 'open' && styles.segmentTextOn]}
                >
                  🌐 Open Challenge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, battleType === 'direct' && styles.segmentBtnOn]}
                onPress={() => setBattleType('direct')}
              >
                <Text
                  style={[styles.segmentText, battleType === 'direct' && styles.segmentTextOn]}
                >
                  🎯 Direct Callout
                </Text>
              </TouchableOpacity>
            </View>

            {battleType === 'direct' ? (
              <>
                <Text style={styles.label}>RIVAL HANDLE</Text>
                <TextInput
                  style={styles.input}
                  value={rivalHandle}
                  onChangeText={setRivalHandle}
                  placeholder="Tag rival e.g. @NYC_LIFT"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                />
              </>
            ) : null}

            <Text style={styles.label}>MATCH LENGTH</Text>
            <View style={styles.wrapPills}>
              {DURATIONS.map((d) => {
                const active = durationId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setDurationId(d.id)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>SCHEDULED TIME</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentBtn, scheduleMode === 'now' && styles.segmentBtnOn]}
                onPress={() => setScheduleMode('now')}
              >
                <Text
                  style={[styles.segmentText, scheduleMode === 'now' && styles.segmentTextOn]}
                >
                  Go Live Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, scheduleMode === 'later' && styles.segmentBtnOn]}
                onPress={() => setScheduleMode('later')}
              >
                <Text
                  style={[styles.segmentText, scheduleMode === 'later' && styles.segmentTextOn]}
                >
                  Schedule for Later
                </Text>
              </TouchableOpacity>
            </View>

            {scheduleMode === 'later' ? (
              <View style={styles.scheduleMeta}>
                <View style={styles.offsetRow}>
                  {[60, 135, 240].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.offsetChip,
                        laterOffsetMin === mins && styles.offsetChipOn,
                      ]}
                      onPress={() => setLaterOffsetMin(mins)}
                    >
                      <Text
                        style={[
                          styles.offsetChipText,
                          laterOffsetMin === mins && styles.offsetChipTextOn,
                        ]}
                      >
                        +{Math.floor(mins / 60)}h {mins % 60 ? `${mins % 60}m` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.localTime}>Local: {localScheduleLabel}</Text>
                <Text style={styles.countdown}>{countdownLabel}</Text>
                <Text style={styles.utcHint}>UTC: {scheduledAtUTC}</Text>
              </View>
            ) : (
              <Text style={styles.countdown}>{countdownLabel}</Text>
            )}

            <TouchableOpacity style={styles.launchBtn} onPress={launch} activeOpacity={0.9}>
              <Text style={styles.launchBtnText}>LAUNCH BATTLE ⚡</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  accentLine: {
    height: 3,
    backgroundColor: WHITE,
    width: '100%',
  },
  pullBar: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: MUTED,
    opacity: 0.45,
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  close: { color: WHITE, fontSize: 18, fontWeight: '700' },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  pillRow: {
    gap: 8,
    paddingBottom: 4,
  },
  wrapPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#FFFFFF',
  },
  pillText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  pillTextActive: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
  },
  presetChipText: {
    color: OFF_WHITE,
    fontSize: 11,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  segmentBtnOn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  segmentText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  segmentTextOn: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  scheduleMeta: {
    marginTop: 10,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  offsetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  offsetChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  offsetChipOn: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  offsetChipText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  offsetChipTextOn: {
    color: WHITE,
    fontWeight: '800',
  },
  localTime: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
  },
  countdown: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  utcHint: {
    color: MUTED,
    fontSize: 10,
    marginTop: 4,
  },
  launchBtn: {
    marginTop: 20,
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 16,
    alignItems: 'center',
  },
  launchBtnText: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
