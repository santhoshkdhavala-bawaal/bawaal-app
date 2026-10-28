/**
 * THE LOCKER ROOM — training squads, gym circles, sparring logs.
 * Minimalist borderless black-and-white surface.
 *
 * LOCKED production surface — mint clinic + orange Active Hubs as shipped.
 * Do not modify without an explicit unlock.
 * See `.cursor/rules/bawaal-locker-clinic-locked.mdc`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
  createSparringLog,
  createTrainingSquad,
  fetchActiveHubs,
  LOCKER_SETUP_HINT,
} from './src/services/lockerService';
import { isSupabaseConfigured } from './src/services/supabase';
import { ACTIVE_USER } from './src/services/activeUserProfile';
import { textPrompt } from './src/utils/textPrompt';

const BG = '#000000';
const WHITE = '#FFFFFF';
/** Soft metallic slate for secondary hierarchy under pure-white headers */
const SLATE = '#94A3B8';
/** Light mint — health / clinic advisory accent (stealth B&W + recovery cue) */
const CLINIC_MINT = '#4ADE80';
const CLINIC_MINT_SOFT = 'rgba(74, 222, 128, 0.14)';
/** Electric orange — active training hubs (distinct from clinic mint) */
const HUB_ACCENT = '#F97316';
const LINE = 'rgba(255,255,255,0.14)';

/** Seed hubs shown when cloud is empty / offline — same locked demo content. */
const SEED_HUBS = [
  {
    id: 'squad-iron',
    kind: 'TRAINING SQUAD',
    title: 'Iron Circle',
    meta: '6 athletes · Invite only',
    detail: 'Coach brief · Film tomorrow 6AM',
    action: 'VIEW SQUAD',
  },
  {
    id: 'gym-south',
    kind: 'GYM CIRCLE',
    title: 'South Turf Unit',
    meta: '12 members · Open join',
    detail: 'PR night · Chalk + straps',
    action: 'JOIN CIRCLE',
  },
  {
    id: 'spar-night',
    kind: 'SPARRING LOG',
    title: 'Night Shift Athletics',
    meta: '8 sessions logged this week',
    detail: 'Last: 3-round shadow · notes pinned',
    action: 'OPEN LOG',
  },
  {
    id: 'squad-lift',
    kind: 'TRAINING SQUAD',
    title: 'Lift Wars Inner',
    meta: '4 athletes · Strategy board',
    detail: 'Next block: heavy triples',
    action: 'VIEW SQUAD',
  },
];

function HubCard({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.hubCard}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.action} ${item.title}`}
    >
      <Text style={styles.hubKind}>{item.kind}</Text>
      <Text style={styles.hubTitle}>{item.title}</Text>
      <Text style={styles.hubMeta}>{item.meta}</Text>
      <Text style={styles.hubDetail} numberOfLines={2}>
        {item.detail}
      </Text>
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
    Alert.alert('Supabase', LOCKER_SETUP_HINT);
    return false;
  };

  const onCreateSquad = () => {
    if (!guardCloud()) return;
    textPrompt({
      title: 'Create Training Squad',
      message: 'Name your squad',
      defaultValue: 'New Training Squad',
      confirmLabel: 'Create',
      onSubmit: async (name) => {
        if (busy) return;
        setBusy(true);
        try {
          const { hub, error } = await createTrainingSquad({
            name,
            createdBy: ACTIVE_USER?.handle || 'athlete',
          });
          if (error) {
            Alert.alert('Squad', error.message || 'Could not create squad');
            return;
          }
          if (hub) setHubs((prev) => [hub, ...prev.filter((h) => h.id !== hub.id)]);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const onStartSparring = () => {
    if (!guardCloud()) return;
    textPrompt({
      title: 'Start Sparring Log',
      message: 'Title for this log',
      defaultValue: 'New Sparring Log',
      confirmLabel: 'Start',
      onSubmit: async (title) => {
        if (busy) return;
        setBusy(true);
        try {
          const { hub, error } = await createSparringLog({
            title,
            createdBy: ACTIVE_USER?.handle || 'athlete',
          });
          if (error) {
            Alert.alert('Sparring', error.message || 'Could not start log');
            return;
          }
          if (hub) setHubs((prev) => [hub, ...prev.filter((h) => h.id !== hub.id)]);
        } finally {
          setBusy(false);
        }
      },
    });
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
          <HubCard key={hub.id} item={hub} onPress={() => {}} />
        ))}

        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onCreateSquad}
          disabled={busy}
        >
          <Text style={styles.textActionLabel}>+ CREATE TRAINING SQUAD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onStartSparring}
          disabled={busy}
        >
          <Text style={styles.textActionLabel}>+ START SPARRING LOG</Text>
        </TouchableOpacity>
      </ScrollView>
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
    color: HUB_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  hubCard: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
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
  textActionLabel: {
    color: HUB_ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
