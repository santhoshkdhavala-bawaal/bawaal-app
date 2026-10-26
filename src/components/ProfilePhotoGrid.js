/**
 * Instagram-style 3-column photo gallery for Passport profiles.
 * B&W chrome; tiles are media only (no colored frames).
 */
import React, { memo, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.18)';
const GAP = 2;

function ProfilePhotoGrid({ photos = [], onPressPhoto }) {
  const [failed, setFailed] = useState(() => new Set());
  const tile = useMemo(() => {
    const w = Dimensions.get('window').width;
    // Parent usually pads 16; grid is full bleed within content — use ~ content width
    const content = Math.max(280, w - 32);
    return (content - GAP * 2) / 3;
  }, []);

  if (!photos.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.empty}>No photos yet — sports stills land here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => {
        const broken = failed.has(photo.id);
        return (
          <TouchableOpacity
            key={photo.id}
            activeOpacity={0.88}
            onPress={() => onPressPhoto?.(photo, index)}
            style={[styles.tile, { width: tile, height: tile }]}
          >
            {photo.uri && !broken ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.image}
                onError={() =>
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(photo.id);
                    return next;
                  })
                }
              />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.fallbackIcon}>▣</Text>
                <Text style={styles.fallbackLabel} numberOfLines={2}>
                  {photo.caption || 'PHOTO'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: BG,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    backgroundColor: SURFACE,
  },
  fallbackIcon: {
    color: WHITE,
    fontSize: 18,
    marginBottom: 4,
  },
  fallbackLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
  },
  empty: {
    color: MUTED,
    fontSize: 12,
  },
});

export default memo(ProfilePhotoGrid);
