/**
 * THE CLINIC & CORNER — public athlete Q&A with verified expert guidance.
 * Minimalist borderless black-and-white surface.
 *
 * LOCKED production surface — do not modify without an explicit unlock.
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
import {
  askClinicQuestion,
  CLINIC_SETUP_HINT,
  fetchClinicFeed,
  postClinicReply,
} from './src/services/clinicService';
import { isSupabaseConfigured } from './src/services/supabase';
import { ACTIVE_USER } from './src/services/activeUserProfile';
import BawaalPromptModal from './src/components/BawaalPromptModal';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#8A8A8A';
const OFF_WHITE = '#E8ECE9';
const LINE = 'rgba(255,255,255,0.14)';
/** Electric mint — Ask The Clinic CTA accent */
const CLINIC_MINT = '#4ADE80';

/** Seed feed when cloud is empty / offline — same locked demo content. */
const SEED_FEED = [
  {
    id: 'q1',
    athlete: '@ROHIT_CRICKET',
    sport: 'CRICKET',
    question: 'Best ways to prevent calf cramps during long bowling spells in heat?',
    time: '2h ago',
    expert: {
      name: 'Dr. Mehta',
      role: 'SPORTS DOCTOR · VERIFIED',
      response:
        'Prioritize electrolyte balance (sodium + potassium), gradual warm-up sets, and mid-spell hydration with low-sugar fluids. Stop if spasms persist — get assessed for heat stress.',
      hasVideo: true,
      videoLabel: 'VIDEO ADVISORY · 0:48',
    },
  },
  {
    id: 'q2',
    athlete: '@AMAN_STRIKE',
    sport: 'COMBAT',
    question: 'Rolled my ankle lightly after sparring — when is it safe to return to pads?',
    time: '5h ago',
    expert: {
      name: 'Priya Nair',
      role: 'PHYSIO · VERIFIED',
      response:
        'Use RICE for 48h, then pain-free range of motion before load. Return only when you can hop single-leg without swelling rebound. Tape is support, not a green light.',
      hasVideo: false,
    },
  },
  {
    id: 'q3',
    athlete: '@MIA_TORQUE',
    sport: 'GYM',
    question: 'Fight-night nerves wreck my sleep — any mental prep that actually helps?',
    time: 'Yesterday',
    expert: {
      name: 'Dr. Arjun Shah',
      role: 'SPORTS PSYCHIATRIST · VERIFIED',
      response:
        'Keep a fixed wind-down: breath pacing (4-6), short visualization of process cues (not outcome), and no highlight doom-scrolling after 9pm. Persistent insomnia or panic needs clinical follow-up.',
      hasVideo: true,
      videoLabel: 'VIDEO ADVISORY · 1:12',
    },
  },
  {
    id: 'q4',
    athlete: '@YUKI_LIFT',
    sport: 'GYM',
    question: 'Joint sprain after heavy triples — ice or move?',
    time: 'Yesterday',
    expert: null,
  },
];

const LIABILITY =
  'Advisory only. Doctors, physios, and sports psychiatrists post in their independent capacity. BAWAAL assumes no medical, clinical, or psychiatric liability. Seek in-person care for injuries or mental-health concerns.';

function QuestionCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.athlete}>{item.athlete}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      <Text style={styles.sportTag}>{item.sport}</Text>
      <Text style={styles.question}>{item.question}</Text>

      {item.expert ? (
        <View style={styles.expertBlock}>
          <Text style={styles.expertRole}>{item.expert.role}</Text>
          <Text style={styles.expertName}>{item.expert.name}</Text>
          <Text style={styles.expertResponse}>{item.expert.response}</Text>
          {item.expert.hasVideo ? (
            <TouchableOpacity style={styles.videoRow} activeOpacity={0.75}>
              <Text style={styles.videoLabel}>{item.expert.videoLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.liabilityNote}>{LIABILITY}</Text>
        </View>
      ) : (
        <Text style={styles.awaiting}>AWAITING VERIFIED EXPERT RESPONSE</Text>
      )}
    </View>
  );
}

export default function ClinicScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState(SEED_FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((title, message) => {
    setNotice({ title, message });
  }, []);

  const loadFeed = useCallback(async () => {
    const { feed: live, error } = await fetchClinicFeed();
    if (error && !isSupabaseConfigured()) {
      setFeed(SEED_FEED);
      return;
    }
    if (error) {
      console.warn('[Clinic] load:', error?.message || error);
      setFeed((prev) => (prev?.length ? prev : SEED_FEED));
      return;
    }
    setFeed(live.length ? live : SEED_FEED);
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFeed();
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed]);

  const guardCloud = () => {
    if (isSupabaseConfigured()) return true;
    showNotice('Supabase', CLINIC_SETUP_HINT);
    return false;
  };

  const onAskClinic = () => {
    if (!guardCloud()) return;
    setPrompt({
      kind: 'ask',
      title: 'Ask The Clinic',
      message: 'Your question for verified experts. Posts with your athlete handle.',
      defaultValue: 'Advice on training load this week?',
      confirmLabel: 'POST',
      placeholder: 'Write your question',
      multiline: true,
    });
  };

  const onPostExpert = () => {
    if (!guardCloud()) return;
    const awaiting = feed.find((q) => !q.expert);
    if (!awaiting) {
      showNotice('Clinic', 'No open questions awaiting a reply.');
      return;
    }
    setPrompt({
      kind: 'expert',
      questionId: awaiting.id,
      title: 'Expert Reply',
      message: `Reply to ${awaiting.athlete}`,
      defaultValue: 'Rest, progressive load, and reassess if pain persists.',
      confirmLabel: 'POST',
      placeholder: 'Verified advisory',
      multiline: true,
    });
  };

  const closePrompt = () => {
    if (!busy) setPrompt(null);
  };

  const submitPrompt = async (value) => {
    if (!prompt || busy) return;
    const text = String(value || '').trim();
    if (!text) {
      showNotice('Clinic', 'Enter text to continue.');
      return;
    }
    setBusy(true);
    try {
      if (prompt.kind === 'ask') {
        const { item } = await askClinicQuestion({
          question: text,
          sport: ACTIVE_USER?.sportInterest || 'GYM',
          athleteHandle: ACTIVE_USER?.handle,
        });
        if (item) setFeed((prev) => [item, ...prev.filter((q) => q.id !== item.id)]);
      } else if (prompt.kind === 'expert') {
        const { reply } = await postClinicReply({
          questionId: prompt.questionId,
          expertName: ACTIVE_USER?.displayName || 'Verified Expert',
          expertRole: 'VERIFIED EXPERT',
          response: text,
        });
        if (reply) {
          setFeed((prev) =>
            prev.map((q) =>
              q.id === prompt.questionId
                ? {
                    ...q,
                    expert: {
                      name: String(reply.expert_name),
                      role: String(reply.expert_role),
                      response: String(reply.response),
                      hasVideo: Boolean(reply.has_video),
                      videoLabel: reply.video_label || 'VIDEO ADVISORY',
                    },
                  }
                : q
            )
          );
        }
      }
      setPrompt(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>THE CLINIC & CORNER</Text>
        <Text style={styles.subtitle}>Expert Medical, Physio & Mental Advisory</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 48 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={WHITE}
            colors={[WHITE]}
          />
        }
      >
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>PUBLIC CLINIC FEED</Text>
          <Text style={styles.bannerBody}>
            Athletes ask. Verified sports doctors, physios, and sports psychiatrists answer in public — with clear liability notes on every advisory.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onAskClinic}
          disabled={busy}
        >
          <Text style={styles.askClinicLabel}>+ ASK THE CLINIC</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>LATEST QUESTIONS</Text>

        {feed.map((item) => (
          <QuestionCard key={item.id} item={item} />
        ))}

        <TouchableOpacity
          style={styles.textAction}
          activeOpacity={0.75}
          onPress={onPostExpert}
          disabled={busy}
        >
          <Text style={styles.textActionLabel}>POST AS VERIFIED EXPERT</Text>
        </TouchableOpacity>

        <Text style={styles.footerDisclaimer}>{LIABILITY}</Text>
      </ScrollView>

      <BawaalPromptModal
        visible={Boolean(prompt)}
        mode="prompt"
        title={prompt?.title || ''}
        message={prompt?.message || ''}
        defaultValue={prompt?.defaultValue || ''}
        placeholder={prompt?.placeholder || ''}
        confirmLabel={prompt?.confirmLabel || 'CONFIRM'}
        multiline={Boolean(prompt?.multiline)}
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
  topBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  back: {
    color: OFF_WHITE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  subtitle: {
    marginTop: 8,
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  banner: {
    paddingBottom: 18,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  bannerTitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  bannerBody: {
    color: OFF_WHITE,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 10,
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  athlete: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  time: {
    color: MUTED,
    fontSize: 11,
  },
  sportTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  question: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  expertBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  expertRole: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  expertName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  expertResponse: {
    color: OFF_WHITE,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  videoRow: {
    marginTop: 14,
    paddingVertical: 4,
  },
  videoLabel: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  liabilityNote: {
    marginTop: 14,
    color: MUTED,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '500',
  },
  awaiting: {
    marginTop: 14,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  textAction: {
    marginVertical: 10,
    paddingVertical: 10,
  },
  textActionLabel: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  askClinicLabel: {
    color: CLINIC_MINT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  footerDisclaimer: {
    marginTop: 24,
    marginBottom: 12,
    color: MUTED,
    fontSize: 10,
    lineHeight: 15,
  },
});
