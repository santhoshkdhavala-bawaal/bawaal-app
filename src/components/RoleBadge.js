/**
 * Account role tags — Athlete / Scout / Pro.
 * Monochrome chrome; Scout uses inverted fill to read as a recruiter signal.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const ACCOUNT_ROLES = {
  athlete: { key: 'athlete', label: 'ATHLETE', variant: 'outline' },
  scout: { key: 'scout', label: 'SCOUT', variant: 'solid' },
  pro: { key: 'pro', label: 'PRO', variant: 'outline' },
};

export function normalizeRole(role) {
  const key = String(role || 'athlete').toLowerCase();
  return ACCOUNT_ROLES[key] || ACCOUNT_ROLES.athlete;
}

function RoleBadge({ role = 'athlete', style, compact = false }) {
  const meta = normalizeRole(role);
  const solid = meta.variant === 'solid';
  return (
    <View
      style={[
        styles.base,
        solid ? styles.solid : styles.outline,
        compact && styles.compact,
        style,
      ]}
      accessibilityLabel={`${meta.label} account`}
    >
      <Text style={[styles.text, solid ? styles.textSolid : styles.textOutline]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outline: {
    backgroundColor: 'transparent',
  },
  solid: {
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  textOutline: {
    color: '#FFFFFF',
  },
  textSolid: {
    color: '#000000',
  },
});

export default memo(RoleBadge);
