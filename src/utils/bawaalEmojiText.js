/**
 * Banter / chat shortcodes for BAWAAL skeleton emojis.
 * Forms: `:gym:`  ·  `[bawaal:gym]`
 *
 * Size rules (LOCKED visual impact):
 * - Emoji-only message → size 60 (sticker punch)
 * - Mixed text + emoji → text normal, inline emoji size 24
 */
import React, { memo, useMemo } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { BawaalEmoji, hasBawaalEmoji } from '../../components/BawaalEmoji';

export const BAWAAL_EMOJI_INLINE_SIZE = 24;
export const BAWAAL_EMOJI_HERO_SIZE = 60;

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
 * Inline / hero text + BawaalEmoji for chat / banter bubbles.
 * Auto-sizes: sticker 60 for emoji-only, inline 24 when mixed with text.
 */
export const BawaalEmojiText = memo(function BawaalEmojiText({
  text,
  textStyle,
  /** Override auto size; omit to use impact rules. */
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

  return (
    <View
      style={[
        emojiOnly ? styles.heroRow : styles.inlineRow,
        style,
      ]}
    >
      {segments.map((seg, i) =>
        seg.type === 'emoji' ? (
          <BawaalEmoji
            key={`e-${i}-${seg.value}`}
            name={seg.value}
            size={size}
            style={emojiOnly ? styles.heroEmoji : styles.inlineEmoji}
          />
        ) : String(seg.value || '').length ? (
          <Text
            key={`t-${i}`}
            style={[
              styles.baseText,
              emojiOnly ? styles.hiddenWhitespace : null,
              textStyle,
            ]}
          >
            {emojiOnly ? (String(seg.value).trim() ? seg.value : '') : seg.value}
          </Text>
        ) : null
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? {
          // Keep web bubbles from stretching full desktop width awkwardly
          alignSelf: 'flex-start',
        }
      : null),
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    paddingVertical: 0,
    marginVertical: 0,
    ...(Platform.OS === 'web'
      ? {
          alignSelf: 'flex-start',
        }
      : null),
  },
  baseText: {
    // Baseline-friendly with 24px emoji; RN Text wraps beside Image siblings
    lineHeight: 22,
    ...(Platform.OS === 'web'
      ? {
          display: 'inline',
        }
      : null),
  },
  hiddenWhitespace: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  inlineEmoji: {
    marginHorizontal: 2,
    marginVertical: 0,
    // Nudge toward text baseline on both web + native
    transform: [{ translateY: 1 }],
  },
  heroEmoji: {
    marginHorizontal: 1,
    marginVertical: 0,
  },
});
