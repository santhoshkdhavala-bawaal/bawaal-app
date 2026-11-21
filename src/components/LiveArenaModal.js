/**
 * BAWAAL LIVE hub — list live matches + 5-second GO LIVE setup.
 * Theme: #08120F / #FF5A1F / #E53935
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  listLiveMatches,
  subscribeLiveMatchList,
  createLiveMatch,
  fetchLiveMatchByInviteCode,
} from '../services/liveMatchService';
import {
  LIVE_MATCH_SPORTS,
  DEFAULT_LIVE_MATCH_SPORT,
} from '../constants/liveMatchSports';
import { getActiveUser } from '../services/activeUserProfile';

const BG = '#08120F';
const CARD = '#0F1A16';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const INPUT = '#12201B';

function MatchCard({ item, onPress }) {
  const watching = Math.max(0, Number(item.watching) || 0);
  const hasScoreboard = item?.has_scoreboard !== false;
  const vsLabel = hasScoreboard
    ? `${item.team_a_name || 'TEAM A'} vs ${item.team_b_name || 'TEAM B'}`
    : item.title
      ? String(item.title)
      : `${item.sport || 'LIVE'} TELECAST`;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${vsLabel}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>{item.sport || 'LIVE'}</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.vsTitle} numberOfLines={1}>
        {vsLabel}
      </Text>
      {hasScoreboard && item.title ? (
        <Text style={styles.matchTitle} numberOfLines={1}>
          {item.title}
        </Text>
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.scoreText}>
          {hasScoreboard
            ? `${item.score_a ?? 0} — ${item.score_b ?? 0}`
            : 'TELECAST'}
        </Text>
        <View style={styles.watchRow}>
          <Ionicons name="eye-outline" size={14} color={MUTED} />
          <Text style={styles.watchText}>
            {watching > 0 ? watching : 'LIVE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Stealth sport dropdown — web + Android (Modal + FlatList, no native Picker).
 */
function SportDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = value || DEFAULT_LIVE_MATCH_SPORT;

  const handleSelect = useCallback(
    (sport) => {
      onChange?.(sport);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`Sport ${selected}. Open sport list`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.dropdownTriggerText} numberOfLines={1}>
          {selected}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.dropdownScrim}>
          <TouchableOpacity
            style={styles.dropdownScrimHit}
            activeOpacity={1}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close sport list"
          />
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownSheetHeader}>
              <Text style={styles.dropdownSheetTitle}>SELECT SPORT</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={WHITE} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              style={styles.dropdownList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item === selected;
                return (
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      active && styles.dropdownOptionActive,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        active && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark" size={18} color={ORANGE} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function defaultAdminLabel(user) {
  const raw =
    user?.displayName ||
    user?.name ||
    user?.handle ||
    user?.username ||
    'athlete';
  return String(raw).replace(/^@/, '').trim() || 'athlete';
}

function GoLiveSetup({ onBack, onStarted }) {
  const user = getActiveUser();
  const [sport, setSport] = useState(DEFAULT_LIVE_MATCH_SPORT);
  const [scoreboardOn, setScoreboardOn] = useState(false);
  const [teamA, setTeamA] = useState('TEAM A');
  const [teamB, setTeamB] = useState('TEAM B');
  const [title, setTitle] = useState('');
  const [adminName, setAdminName] = useState(() => defaultAdminLabel(user));
  const [starting, setStarting] = useState(false);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const active = getActiveUser();
      const hostHandle = String(
        active?.handle || active?.username || 'athlete'
      ).replace(/^@/, '');
      const result = await createLiveMatch({
        hostId: String(active?.id || active?.userId || `local:${Date.now()}`),
        hostHandle,
        sport,
        title: scoreboardOn ? title : '',
        teamAName: scoreboardOn ? teamA : 'TEAM A',
        teamBName: scoreboardOn ? teamB : 'TEAM B',
        hasScoreboard: scoreboardOn,
        adminName: scoreboardOn
          ? String(adminName || hostHandle).trim()
          : '',
        scorerName: scoreboardOn
          ? String(adminName || hostHandle).trim()
          : '',
      });
      if (result?.match) {
        onStarted?.(result.match);
        return;
      }
    } finally {
      setStarting(false);
    }
  }, [
    starting,
    sport,
    title,
    teamA,
    teamB,
    scoreboardOn,
    adminName,
    onStarted,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.setupWrap}
    >
      <View style={styles.setupHeader}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to live list"
        >
          <Text style={styles.backLink}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.setupTitle}>GO LIVE</Text>
        <View style={{ width: 48 }} />
      </View>

      <Text style={styles.fieldLabel}>SPORT</Text>
      <SportDropdown
        value={sport}
        options={LIVE_MATCH_SPORTS}
        onChange={setSport}
      />

      <TouchableOpacity
        style={[
          styles.scoreboardToggleRow,
          scoreboardOn && styles.scoreboardToggleRowOn,
        ]}
        onPress={() => setScoreboardOn((v) => !v)}
        activeOpacity={0.88}
        accessibilityRole="switch"
        accessibilityState={{ checked: scoreboardOn }}
        accessibilityLabel={`Scoreboard ${scoreboardOn ? 'on' : 'off'}`}
      >
        <View style={styles.scoreboardToggleCopy}>
          <Text style={styles.scoreboardToggleTitle}>SCOREBOARD</Text>
          <Text style={styles.scoreboardToggleHint}>
            {scoreboardOn
              ? 'Teams, title & admin scorer enabled'
              : 'Pure telecast — banter & reactions only'}
          </Text>
        </View>
        <View
          style={[
            styles.scoreboardSwitch,
            scoreboardOn && styles.scoreboardSwitchOn,
          ]}
        >
          <Text
            style={[
              styles.scoreboardSwitchText,
              scoreboardOn && styles.scoreboardSwitchTextOn,
            ]}
          >
            {scoreboardOn ? 'ON' : 'OFF'}
          </Text>
        </View>
      </TouchableOpacity>

      {scoreboardOn ? (
        <View style={styles.scoreboardDrawer}>
          <Text style={styles.fieldLabel}>TEAM A</Text>
          <TextInput
            style={styles.input}
            value={teamA}
            onChangeText={setTeamA}
            placeholder="TEAM A"
            placeholderTextColor={MUTED}
            maxLength={32}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>TEAM B</Text>
          <TextInput
            style={styles.input}
            value={teamB}
            onChangeText={setTeamB}
            placeholder="TEAM B"
            placeholderTextColor={MUTED}
            maxLength={32}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>TITLE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Friendly School Match"
            placeholderTextColor={MUTED}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>ADMIN</Text>
          <TextInput
            style={styles.input}
            value={adminName}
            onChangeText={setAdminName}
            placeholder="Scorer handle or name"
            placeholderTextColor={MUTED}
            maxLength={40}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.adminHint}>
            Who punches the score — you or a friend/umpire
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.startBtn, starting && styles.startBtnDisabled]}
        onPress={handleStart}
        activeOpacity={0.9}
        disabled={!!starting}
        accessibilityRole="button"
        accessibilityLabel="Start live telecast"
      >
        {starting ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={styles.startBtnText}>START LIVE TELECAST</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function LiveArenaModal({ visible, onClose, onGoLive, onWatchMatch }) {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('hub'); // hub | setup
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [joinStatus, setJoinStatus] = useState('');

  // When closed, always present hub (mode reset happens on close / back presses)
  const sheetVisible = !!visible;
  const effectiveMode = sheetVisible ? mode : 'hub';

  useEffect(() => {
    if (!sheetVisible) return undefined;
    let alive = true;
    void listLiveMatches()
      .then((list) => {
        if (!alive) return;
        setMatches(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const unsub = subscribeLiveMatchList((list) => {
      if (!alive) return;
      setMatches(Array.isArray(list) ? list : []);
      setLoading(false);
    });
    return () => {
      alive = false;
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [sheetVisible]);

  const openSetup = useCallback(() => {
    setMode('setup');
  }, []);

  const closeSetup = useCallback(() => {
    setMode('hub');
  }, []);

  const handleStarted = useCallback(
    (match) => {
      onClose?.();
      onGoLive?.(match);
    },
    [onClose, onGoLive]
  );

  const handleWatch = useCallback(
    (match) => {
      onClose?.();
      onWatchMatch?.(match);
    },
    [onClose, onWatchMatch]
  );

  const handleJoinCode = useCallback(async () => {
    const code = String(inviteCode || '').trim();
    if (!code || joiningCode) return;
    setJoiningCode(true);
    setJoinStatus('');
    try {
      const match = await fetchLiveMatchByInviteCode(code);
      if (match?.id) {
        setInviteCode('');
        setJoinStatus('');
        onClose?.();
        onWatchMatch?.(match);
        return;
      }
      setJoinStatus('No live match found for that code');
    } catch (_) {
      setJoinStatus('Could not join — try again');
    } finally {
      setJoiningCode(false);
    }
  }, [inviteCode, joiningCode, onClose, onWatchMatch]);

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity
          style={styles.scrimHit}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close BAWAAL LIVE hub"
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              maxHeight: '92%',
            },
          ]}
        >
          <View style={styles.handle} />

          {effectiveMode === 'setup' ? (
            <GoLiveSetup
              onBack={closeSetup}
              onStarted={handleStarted}
            />
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>BAWAAL LIVE</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode('hub');
                    onClose?.();
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={WHITE} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.goLiveBtn}
                onPress={openSetup}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Go live now"
              >
                <Text style={styles.goLiveText}>+ GO LIVE NOW</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>JOIN WITH INVITE CODE</Text>
              <View style={styles.codeJoinRow}>
                <TextInput
                  style={styles.codeJoinInput}
                  value={inviteCode}
                  onChangeText={(t) => {
                    setInviteCode(t);
                    if (joinStatus) setJoinStatus('');
                  }}
                  placeholder="6-letter code"
                  placeholderTextColor={MUTED}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[
                    styles.codeJoinBtn,
                    (!inviteCode.trim() || joiningCode) &&
                      styles.codeJoinBtnDisabled,
                  ]}
                  onPress={handleJoinCode}
                  disabled={!inviteCode.trim() || joiningCode}
                  activeOpacity={0.9}
                  hitSlop={8}
                >
                  {joiningCode ? (
                    <ActivityIndicator color={WHITE} size="small" />
                  ) : (
                    <Text style={styles.codeJoinBtnText}>WATCH</Text>
                  )}
                </TouchableOpacity>
              </View>
              {joinStatus ? (
                <Text style={styles.joinStatusText}>{joinStatus}</Text>
              ) : null}

              <Text style={styles.sectionLabel}>ACTIVE TELECASTS</Text>

              {loading && matches.length === 0 ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={matches}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <MatchCard item={item} onPress={handleWatch} />
                  )}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      No live matches yet. Be the first — GO LIVE NOW.
                    </Text>
                  }
                  windowSize={5}
                  maxToRenderPerBatch={8}
                  initialNumToRender={6}
                />
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  scrimHit: {
    flex: 1,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center', width: '100%' },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  goLiveBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
    marginBottom: 18,
  },
  goLiveText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  codeJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  codeJoinInput: {
    flex: 1,
    backgroundColor: INPUT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
    color: WHITE,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 11 : 10,
    fontSize: 13,
    fontWeight: '700',
    outlineStyle: 'none',
  },
  codeJoinBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: ORANGE,
    minWidth: 76,
    alignItems: 'center',
  },
  codeJoinBtnDisabled: {
    opacity: 0.5,
  },
  codeJoinBtnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  joinStatusText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -8,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 8,
    gap: 10,
  },
  emptyText: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.22)',
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sportBadge: {
    backgroundColor: 'rgba(255,90,31,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CRIMSON,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  liveChipText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
  },
  vsTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  matchTitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scoreText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  watchText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  setupWrap: {
    paddingBottom: 8,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backLink: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    width: 48,
  },
  setupTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 10,
  },
  scoreboardToggleRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  scoreboardToggleRowOn: {
    borderColor: 'rgba(255,90,31,0.55)',
    backgroundColor: 'rgba(255,90,31,0.08)',
  },
  scoreboardToggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  scoreboardToggleTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  scoreboardToggleHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 15,
  },
  scoreboardSwitch: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  scoreboardSwitchOn: {
    backgroundColor: CRIMSON,
    borderColor: ORANGE,
  },
  scoreboardSwitchText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scoreboardSwitchTextOn: {
    color: WHITE,
  },
  scoreboardDrawer: {
    marginTop: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
  adminHint: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 14,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INPUT,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,90,31,0.45)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 13 : 12,
  },
  dropdownTriggerText: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dropdownChevron: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
  },
  dropdownScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdownScrimHit: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdownSheet: {
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
    maxHeight: '70%',
    overflow: 'hidden',
    ...Platform.select({
      web: { maxWidth: 420, alignSelf: 'center', width: '100%' },
      default: { width: '100%' },
    }),
  },
  dropdownSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dropdownSheetTitle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  dropdownList: {
    maxHeight: 360,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dropdownOptionActive: {
    backgroundColor: 'rgba(255,90,31,0.16)',
  },
  dropdownOptionText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dropdownOptionTextActive: {
    color: ORANGE,
  },
  input: {
    backgroundColor: INPUT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14,
    fontWeight: '700',
    outlineStyle: 'none',
  },
  startBtn: {
    marginTop: 22,
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  startBtnDisabled: {
    opacity: 0.65,
  },
  startBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
});

export default memo(LiveArenaModal);
