/**
 * Reels / Photos tabs for full athlete passport.
 */
import React, { memo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfilePhotoGrid from './ProfilePhotoGrid';

const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';
const SURFACE = '#0A0A0A';

function ProfileMediaTabs({ clips = [], photos = [], ClipGrid }) {
  const [tab, setTab] = useState('reels');

  return (
    <View>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'reels' && styles.tabOn]}
          onPress={() => setTab('reels')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'reels' && styles.tabTextOn]}>
            REELS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'photos' && styles.tabOn]}
          onPress={() => setTab('photos')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'photos' && styles.tabTextOn]}>
            PHOTOS
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'reels' ? (
        ClipGrid ? (
          <ClipGrid clips={clips} />
        ) : (
          <View style={styles.clipGrid}>
            {clips.map((clip) => (
              <View key={clip.id} style={styles.clipCard}>
                <View style={styles.clipThumb}>
                  <Text style={styles.clipPlay}>▶</Text>
                </View>
                <Text style={styles.clipTitle} numberOfLines={2}>
                  {clip.title}
                </Text>
                <Text style={styles.clipSport}>{clip.sport}</Text>
              </View>
            ))}
            {clips.length === 0 ? (
              <Text style={styles.empty}>No reels yet.</Text>
            ) : null}
          </View>
        )
      ) : (
        <ProfilePhotoGrid photos={photos} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: {
    borderBottomColor: WHITE,
  },
  tabText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  tabTextOn: {
    color: WHITE,
  },
  clipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  clipCard: {
    width: '47.5%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  clipThumb: {
    height: 96,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  clipPlay: {
    color: WHITE,
    fontSize: 18,
  },
  clipTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  clipSport: {
    color: MUTED,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 2,
  },
  empty: {
    color: MUTED,
    fontSize: 12,
  },
});

export default memo(ProfileMediaTabs);
