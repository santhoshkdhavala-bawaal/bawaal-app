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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLiveBattle, newBattleId } from './src/services/battleSyncService';
import { publishArenaChallenge } from './src/services/arenaChallengeService';
import { getActiveUser } from './src/services/activeUserProfile';
import {
  ARENA_SPORT_OPTIONS,
  BAWAAL_FORM_SPORTS,
} from './src/utils/sportCategory';

const BG = '#0A0A0A';
const SURFACE = '#121212';
const BORDER = '#1F2937';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';

const LIVE_SPORTS = BAWAAL_FORM_SPORTS.filter((s) => s !== 'ALL');
const ARENA_SPORTS = ARENA_SPORT_OPTIONS;
const DURATIONS = [
  { id: '1m', label: '1 Min', seconds: 60 },
  { id: '3m', label: '3 Min', seconds: 180 },
  { id: '5m', label: '5 Min', seconds: 300 },
  { id: 'reps', label: 'Custom Rep Goal', seconds: 180 },
];

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

function resolveHost() {
  const user = getActiveUser?.() || {};
  const handle = String(user.handle || '@MUMBAI_STRIKER');
  return {
    handle: handle.startsWith('@') ? handle : `@${handle.replace(/^@/, '')}`,
    userId: String(user.userId || user.id || 'host-local'),
    flag: user.flag || '🇮🇳',
    label: user.label || user.country || 'INDIA',
  };
}

/**
 * Create Battle bottom sheet.
 *
 * intent="openChallenge" — + BATTLE FAB: Create Arena Challenge (sport / target / details / Record Opener)
 * intent="liveBattle"    — Battles / BattleChallengeForm: full LIVE schedule launch
 */
export default function CreateBattleSheet({
  visible,
  onClose,
  onLaunch,
  onPublishOpen,
  onRecordOpener,
  draft = null,
  intent = 'liveBattle',
}) {
  const insets = useSafeAreaInsets();
  const isOpenChallenge = intent === 'openChallenge';
  const sportOptions = isOpenChallenge ? ARENA_SPORTS : LIVE_SPORTS;
  const [sport, setSport] = useState('COMBAT');
  const [title, setTitle] = useState('');
  const [targetDetails, setTargetDetails] = useState('');
  const [battleType, setBattleType] = useState('open'); // open | direct
  const [rivalHandle, setRivalHandle] = useState('@NYC_LIFT');
  const [durationId, setDurationId] = useState('3m');
  const [scheduleMode, setScheduleMode] = useState('now'); // now | later
  const [laterOffsetMin, setLaterOffsetMin] = useState(135); // 2h 15m demo
  const [openerUri, setOpenerUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (draft && isOpenChallenge) {
      setSport(String(draft.sport || 'COMBAT').toUpperCase());
      setTitle(String(draft.title || draft.target || ''));
      setTargetDetails(String(draft.targetDetails || draft.details || ''));
      setOpenerUri(draft.openerUri || draft.openerClipUri || null);
      setSubmitting(false);
      setUploadPct(0);
      return;
    }
    setSport(isOpenChallenge ? 'COMBAT' : 'CRICKET');
    setTitle(isOpenChallenge ? '30-Sec Heavy Bag Combination' : '');
    setTargetDetails(
      isOpenChallenge ? 'Jab-Cross-Hook-Upper · High Tempo' : ''
    );
    setBattleType('open');
    setRivalHandle('@NYC_LIFT');
    setDurationId('3m');
    setScheduleMode('now');
    setLaterOffsetMin(135);
    setOpenerUri(null);
    setSubmitting(false);
    setUploadPct(0);
  }, [visible, draft, isOpenChallenge]);

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

  const buildOpenDraft = () => ({
    sport,
    title: title.trim(),
    target: title.trim(),
    targetDetails: targetDetails.trim(),
    openerUri,
  });

  const recordOpener = () => {
    const nextDraft = buildOpenDraft();
    onRecordOpener?.(nextDraft);
  };

  const buildLivePayload = (host) => {
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
      host: host.handle,
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
                body: `${host.handle} challenged you: ${challengeTitle}! Tap to Accept.`,
                data: { battleId, sport, scheduledAtUTC },
              }
            : null,
        hype_broadcast: {
          type: 'hype_broadcast',
          channel: 'followers',
          title: 'BAWAAL Going Live',
          body: `${host.handle} is live — ${challengeTitle} [${sport}]`,
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
          id: host.userId,
          handle: host.handle,
          flag: host.flag,
          label: host.label,
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

  const publishOpenChallenge = async () => {
    if (submitting) return;
    setSubmitting(true);
    setUploadPct(0);
    const host = resolveHost();
    const challengeTitle = title.trim() || 'OPEN CHALLENGE';

    try {
      const result = await publishArenaChallenge({
        sport,
        targetTitle: challengeTitle,
        targetDetails: targetDetails.trim() || null,
        openerVideoUri: openerUri || null,
        hostId: host.userId,
        hostUsername: host.handle,
        hostFlag: host.flag,
        onUploadProgress: (pct) => setUploadPct(Number(pct) || 0),
      });

      const card = {
        ...(result?.card || {}),
        id: result?.challengeId || result?.card?.id || newBattleId(),
        type: 'battle_thread',
        isOpenChallenge: true,
        isBattle: true,
        status: 'OPEN',
        sport,
        category: sport,
        target: challengeTitle,
        title: challengeTitle,
        targetDetails: targetDetails.trim() || null,
        host: host.handle,
        opponent: host.handle,
        challengerLabel: '@YOU',
        leaderLabel: 'OPEN',
        challengeVideoUri:
          result?.card?.challengeVideoUri ||
          result?.card?.localVideoUri ||
          openerUri ||
          null,
        openerVideoUri: openerUri || null,
        localVideoUri: openerUri || null,
        videoUri:
          result?.card?.publicCloudUrl ||
          result?.card?.challengeVideoUri ||
          openerUri ||
          null,
        responses: [],
        _freshPublish: true,
        feedTarget: 'ARENA',
        source: 'ARENA_CHALLENGE',
      };

      onClose?.();
      onPublishOpen?.(card);
    } catch (err) {
      console.warn('[CreateBattleSheet] open publish failed:', err?.message || err);
    } finally {
      setSubmitting(false);
      setUploadPct(0);
    }
  };

  const launchLive = async () => {
    if (submitting) return;
    setSubmitting(true);
    const host = resolveHost();
    try {
      const battle = buildLivePayload(host);
      await createLiveBattle({
        id: battle.id,
        hostId: host.userId,
        hostUsername: host.handle,
        hostFlag: host.flag,
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
    } catch (err) {
      console.warn('[CreateBattleSheet] live launch failed:', err?.message || err);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (isOpenChallenge) {
      void publishOpenChallenge();
      return;
    }
    void launchLive();
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
            <Text style={styles.headerTitle}>
              {isOpenChallenge ? 'CREATE ARENA CHALLENGE' : 'CREATE A BAWAAL BATTLE'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <Text style={styles.label}>SPORT</Text>
            <View style={styles.wrapPills}>
              {sportOptions.map((s) => {
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
            </View>

            <Text style={styles.label}>
              {isOpenChallenge ? 'CHALLENGE TARGET TITLE' : 'CHALLENGE TITLE'}
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={
                isOpenChallenge
                  ? 'e.g. 30-Sec Heavy Bag Combination'
                  : 'Name your battle / target'
              }
              placeholderTextColor="#666"
            />

            {isOpenChallenge ? (
              <>
                <Text style={styles.label}>TARGET DETAILS / REP COUNT</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={targetDetails}
                  onChangeText={setTargetDetails}
                  placeholder="e.g. Jab-Cross-Hook-Upper · High Tempo"
                  placeholderTextColor="#666"
                  multiline
                />

                <Text style={styles.label}>BENCHMARK OPENER</Text>
                <TouchableOpacity
                  style={styles.openerBtn}
                  onPress={recordOpener}
                  activeOpacity={0.85}
                >
                  <Text style={styles.openerBtnText}>
                    {openerUri
                      ? '✓ OPENER RECORDED · TAP TO RE-RECORD'
                      : '● RECORD OPENER'}
                  </Text>
                </TouchableOpacity>
                {openerUri ? (
                  <TouchableOpacity onPress={() => setOpenerUri(null)} hitSlop={8}>
                    <Text style={styles.clearOpener}>Remove opener</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.hint}>
                    Opens ChallengeCam to capture your heavy-bag benchmark. Publish still works without a clip.
                  </Text>
                )}
              </>
            ) : (
              <>
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
                      style={[
                        styles.segmentText,
                        scheduleMode === 'later' && styles.segmentTextOn,
                      ]}
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
              </>
            )}

            <TouchableOpacity
              style={[styles.launchBtn, submitting && styles.launchBtnDisabled]}
              onPress={submit}
              activeOpacity={0.9}
              disabled={submitting}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color={WHITE} />
                  {isOpenChallenge && uploadPct > 0 ? (
                    <Text style={styles.uploadPctText}>{Math.round(uploadPct)}%</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.launchBtnText}>
                  {isOpenChallenge ? 'PUBLISH CHALLENGE' : 'LAUNCH BATTLE ⚡'}
                </Text>
              )}
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
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadPctText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },
  openerBtn: {
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  openerBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  clearOpener: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  hint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 16,
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
    minHeight: 54,
    justifyContent: 'center',
  },
  launchBtnDisabled: {
    opacity: 0.55,
  },
  launchBtnText: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
