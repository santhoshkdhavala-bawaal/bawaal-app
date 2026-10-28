/**
 * THE LOCKER ROOM — training squads, gym circles, squad briefs.
 * Minimalist borderless black-and-white surface.
 *
 * LOCKED production surface — mint clinic + orange Active Hubs as shipped.
 * Do not modify without an explicit unlock.
 * See `.cursor/rules/bawaal-locker-clinic-locked.mdc`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMainTabs } from './mainTabContext';
import {
  createSquadBrief,
  createTrainingSquad,
  fetchActiveHubs,
  LOCKER_SETUP_HINT,
} from './src/services/lockerService';
import { isSupabaseConfigured } from './src/services/supabase';
import { ACTIVE_USER } from './src/services/activeUserProfile';
import BawaalPromptModal from './src/components/BawaalPromptModal';

const BG = '#000000';
const WHITE = '#FFFFFF';
/** Soft metallic slate for secondary hierarchy under pure-white headers */
const SLATE = '#94A3B8';
/** Light mint — health / clinic advisory accent (stealth B&W + recovery cue) */
const CLINIC_MINT = '#4ADE80';
const CLINIC_MINT_SOFT = 'rgba(74, 222, 128, 0.14)';
/** Signature electric orange — hub card titles / actions */
const HUB_ACCENT = '#FF5500';
/** Electric blue — ACTIVE HUBS primary section header */
const HUBS_BLUE = '#3B82F6';
/** Neon yellow — Create Training Squad CTA */
const CREATE_YELLOW = '#FACC15';
/** Electric purple — Post Squad Brief CTA */
const BRIEF_PURPLE = '#A855F7';
/** Crimson — pinned squad brief label + sport tags (mint reserved for Clinic) */
const BRIEF_CRIMSON = '#EF4444';
const BRIEF_CRIMSON_SOFT = 'rgba(239,68,68,0.16)';
const LINE = 'rgba(255,255,255,0.14)';

/** Seed hubs — squads with pinned Squad Brief headers. */
const SEED_HUBS = [
  {
    id: 'squad-iron',
    kind: 'TRAINING SQUAD',
    title: 'Iron Circle',
    meta: '6 athletes · Invite only',
    detail: 'Coach brief · Film tomorrow 6AM · pads + headgear',
    action: 'VIEW SQUAD',
    brief: {
      id: 'brief-iron',
      title: 'Matchday Lineup & Strategy',
      sportTag: 'COMBAT',
      intel: 'Coach brief · Film tomorrow 6AM · pads + headgear',
    },
  },
  {
    id: 'gym-south',
    kind: 'GYM CIRCLE',
    title: 'South Turf Unit',
    meta: '12 members · Open join',
    detail: 'PR night · Chalk + straps · open floor 7PM',
    action: 'JOIN CIRCLE',
    brief: {
      id: 'brief-south',
      title: 'Friday Sparring Block',
      sportTag: 'GYM',
      intel: 'PR night · Chalk + straps · open floor 7PM',
    },
  },
  {
    id: 'squad-night',
    kind: 'TRAINING SQUAD',
    title: 'Night Shift Athletics',
    meta: '8 athletes · Invite only',
    detail: '3-round shadow · notes pinned · south bay',
    action: 'VIEW SQUAD',
    brief: {
      id: 'brief-night',
      title: 'Night Shift Block',
      sportTag: 'RUNNING',
      intel: '3-round shadow · notes pinned · south bay',
    },
  },
  {
    id: 'squad-lift',
    kind: 'TRAINING SQUAD',
    title: 'Lift Wars Inner',
    meta: '4 athletes · Strategy board',
    detail: 'Next block: heavy triples',
    action: 'VIEW SQUAD',
    brief: null,
  },
];

function HubCard({ item, onPress }) {
  const brief = item?.brief;
  const intelLine = brief?.intel || item.detail;
  return (
    <TouchableOpacity
      style={styles.hubCard}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.action} ${item.title}`}
    >
      {brief ? (
        <View style={styles.briefPin}>
          <Text style={styles.briefPinLabel}>PINNED SQUAD BRIEF</Text>
          <View style={styles.briefPinRow}>
            <Text style={styles.briefPinTitle} numberOfLines={2}>
              {brief.title}
            </Text>
            {brief.sportTag ? (
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>{brief.sportTag}</Text>
              </View>
            ) : null}
          </View>
          {intelLine ? (
            <Text style={styles.briefIntel} numberOfLines={3}>
              {intelLine}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hubKind}>{item.kind}</Text>
      <Text style={styles.hubTitle}>{item.title}</Text>
      <Text style={styles.hubMeta}>{item.meta}</Text>
      {!brief ? (
        <Text style={styles.hubDetail} numberOfLines={2}>
          {item.detail}
        </Text>
      ) : null}
      <Text style={styles.hubAction}>{item.action}</Text>
    </TouchableOpacity>
  );
}

export default function LockerRoomScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { openProfileGateway } = useMainTabs() || {};
  const [hubs, setHubs] = useState(SEED_HUBS);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((title, message) => {
    setNotice({ title, message });
  }, []);

  const openHub = useCallback(
    (hub) => {
      if (!hub) return;
      const lines = [
        hub.kind,
        hub.meta,
        hub.brief ? `BRIEF · ${hub.brief.title} · ${hub.brief.sportTag}` : null,
        '',
        hub.detail,
        '',
        hub.action ? `${hub.action} ready` : null,
      ].filter((line) => line != null);
      showNotice(hub.title, lines.join('\n'));
    },
    [showNotice]
  );

  const loadHubs = useCallback(async () => {
    const { hubs: live, error } = await fetchActiveHubs();
    if (error && !isSupabaseConfigured()) {
      setHubs(SEED_HUBS);
      return;
    }
    if (error) {
      console.warn('[LockerRoom] load:', error?.message || error);
      setHubs((prev) => (prev?.length ? prev : SEED_HUBS));
      return;
    }
    setHubs(live.length ? live : SEED_HUBS);
  }, []);

  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHubs();
    } finally {
      setRefreshing(false);
    }
  }, [loadHubs]);

  const openClinic = () => {
    navigation?.navigate?.('Clinic');
  };

  const guardCloud = () => {
    if (isSupabaseConfigured()) return true;
    showNotice('Supabase', LOCKER_SETUP_HINT);
    return false;
  };

  const onCreateSquad = () => {
    if (!guardCloud()) return;
    setPrompt({
      kind: 'squad',
      mode: 'prompt',
      title: 'Create Training Squad',
      message: 'Name your squad. Posts with kind TRAINING SQUAD.',
      defaultValue: 'New Training Squad',
      confirmLabel: 'CREATE',
      placeholder: 'Squad name',
    });
  };

  const onPostSquadBrief = () => {
    if (!guardCloud()) return;
    setPrompt({
      kind: 'brief',
      mode: 'squadBrief',
      title: 'Post Squad Brief',
      message: 'Pin tactical intel to your active squad.',
      defaultValue: 'Matchday Lineup & Strategy',
      confirmLabel: 'POST',
    });
  };

  const closePrompt = () => {
    if (!busy) setPrompt(null);
  };

  const mergeHub = useCallback((hub) => {
    if (!hub) return;
    setHubs((prev) => {
      const without = prev.filter((h) => h.id !== hub.id);
      // If brief pinned onto existing squad, replace that card
      if (hub.source === 'squad') {
        return [hub, ...without];
      }
      return [hub, ...without];
    });
  }, []);

  const submitPrompt = async (payload) => {
    if (!prompt || busy) return;

    if (prompt.kind === 'squad') {
      const text = String(payload || '').trim();
      if (!text) {
        showNotice('BAWAAL', 'Enter a squad name to continue.');
        return;
      }
      setBusy(true);
      try {
        const { hub } = await createTrainingSquad({
          name: text,
          kind: 'TRAINING SQUAD',
          createdBy: ACTIVE_USER?.handle || 'athlete',
        });
        mergeHub(hub);
        setPrompt(null);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (prompt.kind === 'brief') {
      const title = String(payload?.title || '').trim();
      const sportTag = String(payload?.sportTag || 'Other').trim();
      const intel = String(payload?.intel || '').trim();
      if (!title) {
        showNotice('BAWAAL', 'Enter a brief title to continue.');
        return;
      }
      setBusy(true);
      try {
        const handle = ACTIVE_USER?.handle || 'athlete';
        const newestSquad = hubs.find(
          (h) =>
            h.source === 'squad' ||
            String(h.kind || '').includes('SQUAD') ||
            String(h.kind || '').includes('GYM')
        );
        const isUuid =
          newestSquad?.id &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(newestSquad.id)
          );
        const { hub } = await createSquadBrief({
          title,
          sportTag,
          intel,
          squadId: isUuid ? newestSquad.id : null,
          createdBy: handle,
          athleteHandle: handle,
        });
        if (hub) {
          setHubs((prev) => {
            if (newestSquad) {
              const idx = prev.findIndex((h) => h.id === newestSquad.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  brief: hub.brief || {
                    id: hub.brief?.id || hub.id,
                    title,
                    sportTag: sportTag.toUpperCase(),
                    intel,
                  },
                  detail: intel || hub.detail || next[idx].detail,
                };
                return next;
              }
            }
            return [hub, ...prev.filter((h) => h.id !== hub.id)];
          });
        }
        setPrompt(null);
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.brandRow}>
        <TouchableOpacity
          onPress={openProfileGateway}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.brand}>BAWAAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clinicBadge}
          onPress={openClinic}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open The Clinic"
        >
          <Text style={styles.clinicLink}>THE CLINIC</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>THE LOCKER ROOM</Text>
        <Text style={styles.subtitle}>Team Hubs, Training & Strategy</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={HUB_ACCENT}
            colors={[HUB_ACCENT]}
          />
        }
      >
        <TouchableOpacity
          style={styles.navCard}
          onPress={openClinic}
          activeOpacity={0.75}
        >
          <Text style={styles.navCardLabel}>ADVISORY</Text>
          <Text style={styles.navCardTitle}>THE CLINIC & CORNER</Text>
          <Text style={styles.navCardBody}>
            Expert medical, physio & mental guidance for the arena.
          </Text>
          <Text style={styles.navCardAction}>ENTER CLINIC</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>ACTIVE HUBS</Text>

        {hubs.map((hub) => (
          <HubCard key={hub.id} item={hub} onPress={() => openHub(hub)} />
        ))}

        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onCreateSquad}
          disabled={busy}
        >
          <Text style={styles.createSquadLabel}>+ CREATE TRAINING SQUAD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onPostSquadBrief}
          disabled={busy}
        >
          <Text style={styles.postBriefLabel}>+ POST SQUAD BRIEF</Text>
        </TouchableOpacity>
      </ScrollView>

      <BawaalPromptModal
        visible={Boolean(prompt)}
        mode={prompt?.mode || 'prompt'}
        title={prompt?.title || ''}
        message={prompt?.message || ''}
        defaultValue={prompt?.defaultValue || ''}
        placeholder={prompt?.placeholder || ''}
        confirmLabel={prompt?.confirmLabel || 'CONFIRM'}
        onConfirm={submitPrompt}
        onCancel={closePrompt}
        busy={busy}
      />
      <BawaalPromptModal
        visible={Boolean(notice)}
        mode="notice"
        title={notice?.title || 'BAWAAL'}
        message={notice?.message || ''}
        onCancel={() => setNotice(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  brand: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  clinicBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: CLINIC_MINT_SOFT,
  },
  clinicLink: {
    color: CLINIC_MINT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  subtitle: {
    marginTop: 8,
    color: SLATE,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  navCard: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  navCardLabel: {
    color: CLINIC_MINT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  navCardTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  navCardBody: {
    color: SLATE,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  navCardAction: {
    color: CLINIC_MINT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  sectionLabel: {
    color: HUBS_BLUE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  hubCard: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  briefPin: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  briefPinLabel: {
    color: BRIEF_CRIMSON,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  briefPinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  briefPinTitle: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginRight: 10,
  },
  briefIntel: {
    marginTop: 8,
    color: SLATE,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  sportBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: BRIEF_CRIMSON_SOFT,
  },
  sportBadgeText: {
    color: BRIEF_CRIMSON,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  hubKind: {
    color: SLATE,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  hubTitle: {
    color: HUB_ACCENT,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  hubMeta: {
    marginTop: 6,
    color: SLATE,
    fontSize: 12,
  },
  hubDetail: {
    marginTop: 8,
    color: SLATE,
    fontSize: 13,
    lineHeight: 18,
  },
  hubAction: {
    marginTop: 14,
    color: HUB_ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  textAction: {
    marginTop: 18,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  createSquadLabel: {
    color: CREATE_YELLOW,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  postBriefLabel: {
    color: BRIEF_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
