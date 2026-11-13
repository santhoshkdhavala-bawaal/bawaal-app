/**
 * Banter / chat shortcodes for BAWAAL skeleton emojis.
 * Forms: `:gym:`  ·  `[bawaal:gym]` · `:love:`
 *
 * Size rules:
 * - Emoji-only → size 64 (sticker)
 * - Mixed text + emoji → size 36 in one flex row (side-by-side, natural wrap)
 */
import React, { memo, useMemo } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { BawaalEmoji, hasBawaalEmoji } from '../../components/BawaalEmoji';

/** Clean inline height alongside body text (same flex row). */
export const BAWAAL_EMOJI_INLINE_SIZE = 36;
/** Pure emoji / reaction stickers. */
export const BAWAAL_EMOJI_HERO_SIZE = 64;

/** Matches `:key:` or legacy `[bawaal:key]` tokens. */
export const BAWAAL_EMOJI_TOKEN_RE = /(:([a-z0-9_]+):|\[bawaal:([a-z0-9_]+)\])/gi;

export function toBawaalShortcode(key) {
  const k = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/^skel_/, '')
    .replace(/^:+|:+$/g, '');
  if (!k) return '';
  return ` :${k}: `;
}

/**
 * Split message text into plain text + emoji segments for inline rendering.
 * @returns {{ type: 'text'|'emoji', value: string }[]}
 */
export function parseBawaalEmojiSegments(text) {
  const raw = String(text || '');
  if (!raw) return [];

  const segments = [];
  let last = 0;
  const re = new RegExp(BAWAAL_EMOJI_TOKEN_RE.source, 'gi');
  let match;
  while ((match = re.exec(raw)) != null) {
    const key = (match[2] || match[3] || '').toLowerCase();
    if (match.index > last) {
      segments.push({ type: 'text', value: raw.slice(last, match.index) });
    }
    if (key && hasBawaalEmoji(key)) {
      segments.push({ type: 'emoji', value: key });
    } else {
      segments.push({ type: 'text', value: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < raw.length) {
    segments.push({ type: 'text', value: raw.slice(last) });
  }
  return segments;
}

export function messageHasBawaalEmoji(text) {
  return parseBawaalEmojiSegments(text).some((s) => s.type === 'emoji');
}

/**
 * True when the message is only skeleton shortcodes (optional whitespace), no real text.
 */
export function isEmojiOnlyMessage(textOrSegments) {
  const segments = Array.isArray(textOrSegments)
    ? textOrSegments
    : parseBawaalEmojiSegments(textOrSegments);
  if (!segments.length) return false;
  let emojiCount = 0;
  for (const seg of segments) {
    if (seg.type === 'emoji') {
      emojiCount += 1;
      continue;
    }
    if (String(seg.value || '').trim()) return false;
  }
  return emojiCount > 0;
}

/**
 * Text + BawaalEmoji for chat / banter bubbles.
 * Mixed: single flex-row container so text + emoji stay side-by-side (wrap only when needed).
 */
export const BawaalEmojiText = memo(function BawaalEmojiText({
  text,
  textStyle,
  emojiSize,
  inlineEmojiSize = BAWAAL_EMOJI_INLINE_SIZE,
  heroEmojiSize = BAWAAL_EMOJI_HERO_SIZE,
  style,
}) {
  const segments = useMemo(() => parseBawaalEmojiSegments(text), [text]);
  const emojiOnly = useMemo(() => isEmojiOnlyMessage(segments), [segments]);

  if (!segments.length) return null;

  const size =
    typeof emojiSize === 'number' && emojiSize > 0
      ? emojiSize
      : emojiOnly
        ? heroEmojiSize
        : inlineEmojiSize;

  if (emojiOnly) {
    return (
      <View style={[styles.heroRow, style]}>
        {segments.map((seg, i) =>
          seg.type === 'emoji' ? (
            <BawaalEmoji
              key={`e-${i}-${seg.value}`}
              name={seg.value}
              size={size}
              style={styles.heroEmoji}
            />
          ) : null
        )}
      </View>
    );
  }

  return (
    <View style={[styles.mixedRow, style]}>
      {segments.map((seg, i) => {
        if (seg.type === 'emoji') {
          return (
            <View key={`e-${i}-${seg.value}`} style={styles.emojiSlot}>
              <BawaalEmoji name={seg.value} size={size} style={styles.mixedEmoji} />
            </View>
          );
        }
        const value = String(seg.value || '');
        if (!value) return null;
        return (
          <Text key={`t-${i}`} style={[styles.mixedText, textStyle]}>
            {value}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  mixedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? {
          alignSelf: 'flex-start',
        }
      : null),
  },
  mixedText: {
    fontSize: 12,
    lineHeight: 36,
    // Critical: do NOT stretch to full width or the emoji drops to the next line
    flexGrow: 0,
    flexShrink: 1,
    ...(Platform.OS === 'web'
      ? {
          display: 'inline',
          width: 'auto',
          maxWidth: '100%',
        }
      : null),
  },
  emojiSlot: {
    width: BAWAAL_EMOJI_INLINE_SIZE,
    height: BAWAAL_EMOJI_INLINE_SIZE,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  mixedEmoji: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? {
          alignSelf: 'flex-start',
        }
      : null),
  },
  heroEmoji: {
    marginHorizontal: 1,
    marginVertical: 0,
  },
});
