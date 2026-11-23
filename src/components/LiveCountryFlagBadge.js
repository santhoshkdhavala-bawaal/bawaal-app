/**
 * Full-color national flag badge for BAWAAL LIVE (GO LIVE / roster / room).
 * Uses flagcdn PNG when ISO is known; falls back to Unicode emoji offline / onError.
 */
import React, { memo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { flagCdnUri } from '../utils/liveMatchLocationFlag';

const SIZES = {
  sm: { box: 18, imgW: 18, imgH: 12, emoji: 13, radius: 3 },
  md: { box: 32, imgW: 32, imgH: 22, emoji: 18, radius: 4 },
  lg: { box: 40, imgW: 40, imgH: 28, emoji: 22, radius: 6 },
};

function LiveCountryFlagBadge({
  isoCode,
  flagEmoji,
  countryName,
  size = 'md',
  /** When true, badge + image fill the parent box (GO LIVE location preview). */
  fill = false,
  style,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const iso = String(isoCode || '')
    .trim()
    .toUpperCase();
  const emoji = String(flagEmoji || '').trim();
  const uri = flagCdnUri(iso);
  const dims = SIZES[size] || SIZES.md;
  const label = countryName
    ? `Country flag ${countryName}`
    : iso
      ? `Country flag ${iso}`
      : 'Country flag';

  if (!uri && !emoji) return null;

  const showImage = !!uri && !imageFailed;

  return (
    <View
      style={[
        styles.badge,
        fill
          ? styles.badgeFill
          : {
              width: dims.box,
              height: Math.max(dims.imgH + 4, dims.box * 0.7),
              borderRadius: dims.radius,
            },
        style,
      ]}
      accessibilityLabel={label}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={
            fill
              ? styles.imageFill
              : {
                  width: dims.imgW,
                  height: dims.imgH,
                  borderRadius: dims.radius,
                }
          }
          resizeMode="cover"
          accessibilityLabel={label}
          onError={() => setImageFailed(true)}
        />
      ) : emoji ? (
        <Text
          style={[
            styles.emoji,
            fill
              ? styles.emojiFill
              : { fontSize: dims.emoji, lineHeight: dims.emoji + 2 },
          ]}
          allowFontScaling={false}
        >
          {emoji}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  badgeFill: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    textAlign: 'center',
  },
  emojiFill: {
    fontSize: 28,
    lineHeight: 32,
  },
});

export default memo(LiveCountryFlagBadge);
