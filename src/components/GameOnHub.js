/**
 * GAME ON interactive command drawer —
 * search + Near Me map, battle-tier filters.
 */
import React, { memo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ARENA_FEED_TIERS } from '../constants/arenaFeedTiers';

const WHITE = '#FFFFFF';
const BG = '#0A0A0A';
const SURFACE = '#121212';
const MUTED = '#A9A9A9';
const ACCENT = '#FF5A00';

function GameOnHub({
  visible,
  onClose,
  selectedFeedTier = 'all',
  onSelectFeedTier,
  onOpenSportHubMap,
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const openMap = () => {
    onClose?.();
    onOpenSportHubMap?.();
  };

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close GAME ON"
        />
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 18),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>COMMAND DRAWER</Text>
              <Text style={styles.title}>▶ GAME ON</Text>
              <Text style={styles.subtitle}>SEARCH · NEAR ME · FILTERS</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={16} color={MUTED} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search athletes, arenas, battles..."
                placeholderTextColor={MUTED}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={openMap}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Near Me map"
            >
              <Ionicons name="map-outline" size={15} color={WHITE} />
              <Text style={styles.mapBtnText}>NEAR ME</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BATTLE CATEGORIES</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tierRow}
                keyboardShouldPersistTaps="handled"
              >
                {ARENA_FEED_TIERS.map((tier) => {
                  const active = String(selectedFeedTier) === String(tier.id);
                  return (
                    <TouchableOpacity
                      key={tier.id}
                      style={[styles.tierPill, active && styles.tierPillActive]}
                      onPress={() => {
                        onSelectFeedTier?.(tier.id);
                        onClose?.();
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Filter ${tier.label}`}
                    >
                      <Text
                        style={[
                          styles.tierPillText,
                          active && styles.tierPillTextActive,
                        ]}
                      >
                        {tier.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    maxHeight: '78%',
    minHeight: '42%',
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 90, 0, 0.35)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 4,
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  close: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 0,
  },
  mapBtn: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapBtnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  section: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tierRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 4,
  },
  tierPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tierPillActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(255,90,0,0.16)',
  },
  tierPillText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tierPillTextActive: {
    color: WHITE,
  },
});

export default memo(GameOnHub);
