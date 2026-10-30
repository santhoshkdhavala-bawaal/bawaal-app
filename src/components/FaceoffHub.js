/**
 * FACEOFF hub — Live Scores + Sports Categories only (stealth-black).
 * Open Callouts live on the BATTLES tab.
 */
import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackLink from './BackLink';
import ScoresSportsPanel from './ScoresSportsPanel';
import {
  BAWAAL_SPORT_TAXONOMY,
  canonicalizeSport,
} from '../utils/sportCategory';

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const MUTED = '#A0A0A0';

const SPORT_GRID = BAWAAL_SPORT_TAXONOMY.length
  ? BAWAAL_SPORT_TAXONOMY
  : ['ALL'];

function FaceoffHub({
  visible,
  onClose,
  selectedSport = 'ALL',
  onSelectSport,
}) {
  const insets = useSafeAreaInsets();
  const sport = canonicalizeSport(selectedSport) || 'ALL';

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <BackLink label="Arena" onPress={onClose} />
          <Text style={styles.title}>FACEOFF</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subtitle}>LIVE SCORES · SPORTS</Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LIVE SCORES</Text>
            <ScoresSportsPanel />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPORTS</Text>
            <View style={styles.sportGrid}>
              {SPORT_GRID.map((pill) => {
                const active = sport === pill;
                return (
                  <TouchableOpacity
                    key={pill}
                    style={[styles.sportCell, active && styles.sportCellOn]}
                    onPress={() =>
                      onSelectSport?.(canonicalizeSport(pill) || pill)
                    }
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Sport ${pill}`}
                  >
                    <Text
                      style={[
                        styles.sportCellText,
                        active && styles.sportCellTextOn,
                      ]}
                      numberOfLines={1}
                    >
                      {pill}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 36,
  },
  headerSpacer: {
    width: 88,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  sportCell: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WHITE,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  sportCellOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sportCellText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sportCellTextOn: {
    fontWeight: '900',
  },
});

export default memo(FaceoffHub);
