/**
 * Banter / chat shortcodes for BAWAAL skeleton emojis.
 * Forms: `:gym:`  ·  `[bawaal:gym]`
 */
import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { BawaalEmoji, hasBawaalEmoji } from '../../components/BawaalEmoji';

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
 * Inline text + BawaalEmoji chips for chat / banter bubbles.
 */
export const BawaalEmojiText = memo(function BawaalEmojiText({
  text,
  textStyle,
  emojiSize = 18,
  style,
}) {
  const segments = parseBawaalEmojiSegments(text);
  if (!segments.length) return null;

  return (
    <View style={[styles.row, style]}>
      {segments.map((seg, i) =>
        seg.type === 'emoji' ? (
          <BawaalEmoji
            key={`e-${i}-${seg.value}`}
            name={seg.value}
            size={emojiSize}
            style={styles.inlineEmoji}
          />
        ) : seg.value ? (
          <Text key={`t-${i}`} style={textStyle}>
            {seg.value}
          </Text>
        ) : null
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineEmoji: {
    marginHorizontal: 1,
    marginVertical: 1,
  },
});
