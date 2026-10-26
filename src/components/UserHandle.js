/**
 * @handle row with optional official VerifiedBadge.
 * Use across feeds, comments, and profile headers.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VerifiedBadge from './VerifiedBadge';
import { isHandleVerified } from '../data/athleteSocial';

function formatHandle(raw) {
  const s = String(raw || 'athlete').trim();
  if (!s) return '@athlete';
  return s.startsWith('@') ? s : `@${s.replace(/^@/, '')}`;
}

function UserHandle({
  handle,
  verified,
  size = 14,
  color = '#FFFFFF',
  numberOfLines = 1,
  style,
  textStyle,
  badgeSize,
}) {
  const display = formatHandle(handle);
  const showTick =
    verified === true ||
    (verified !== false && isHandleVerified(display));

  return (
    <View style={[styles.row, style]}>
      <Text
        style={[styles.handle, { color, fontSize: size }, textStyle]}
        numberOfLines={numberOfLines}
      >
        {display}
      </Text>
      {showTick ? (
        <VerifiedBadge size={badgeSize ?? Math.max(12, size - 1)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  handle: {
    fontWeight: '800',
    flexShrink: 1,
  },
});

export default memo(UserHandle);
