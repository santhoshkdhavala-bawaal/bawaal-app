import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { clearRegisteredSession } from './sessionStore';

const BG = '#000000';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';
const OFF_WHITE = '#E8ECE9';
const LOGOUT_RED = '#EF4444';

const DEFAULT_USER = {
  displayName: 'Rohit Kumar',
  username: 'Rohit_VK7',
  handle: '@rohit_vk7',
  email: 'rohit@bawaal.app',
  phone: '+91 98765 43210',
  city: 'Virar West, Mumbai',
  primarySport: 'COMBAT',
  tier: 'SCOUT VERIFIED',
  badges: ['COMBAT', 'VIRAR #1', '18 WINS'],
};

/**
 * Slide-over profile gateway opened from BAWAAL brand tap.
 * Edit Profile opens an inline personal data form.
 */
export default function ProfileGatewayModal({
  visible,
  onClose,
  onOpenPassport,
  onOpenSportHubMap,
  onLogOut,
  user = DEFAULT_USER,
}) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState(user);
  const [form, setForm] = useState({
    fullName: user.displayName || '',
    phone: user.phone || '',
    email: user.email || '',
    city: user.city || '',
  });

  useEffect(() => {
    if (!visible) {
      setEditing(false);
      setLoggingOut(false);
      return;
    }
    setProfile(user);
    setForm({
      fullName: user.displayName || '',
      phone: user.phone || '',
      email: user.email || '',
      city: user.city || '',
    });
  }, [visible, user]);

  const initial = (profile.displayName || profile.username || 'U').charAt(0).toUpperCase();

  const saveChanges = () => {
    setProfile((prev) => ({
      ...prev,
      displayName: form.fullName.trim() || prev.displayName,
      phone: form.phone.trim() || prev.phone,
      email: form.email.trim() || prev.email,
      city: form.city.trim() || prev.city,
    }));
    setEditing(false);
  };

  const handleLogOut = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[ProfileGateway] signOut:', err?.message || err);
      }
      await clearRegisteredSession();
      onClose?.();
      if (onLogOut) {
        await onLogOut();
      }
    } catch (err) {
      console.warn('[ProfileGateway] log out failed:', err?.message || err);
      setLoggingOut(false);
    }
  }, [loggingOut, onClose, onLogOut]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editing ? 'EDIT PROFILE' : 'PROFILE'}</Text>
            <TouchableOpacity
              onPress={() => {
                if (editing) setEditing(false);
                else onClose?.();
              }}
              hitSlop={12}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {editing ? (
              <View style={styles.formBlock}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  value={form.fullName}
                  onChangeText={(fullName) => setForm((f) => ({ ...f, fullName }))}
                  placeholder="Rohit Kumar"
                  placeholderTextColor={MUTED}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(email) => setForm((f) => ({ ...f, email }))}
                  placeholder="you@bawaal.app"
                  placeholderTextColor={MUTED}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>CITY / TURF LOCATION</Text>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={(city) => setForm((f) => ({ ...f, city }))}
                  placeholder="Virar West, Mumbai"
                  placeholderTextColor={MUTED}
                />

                <TouchableOpacity
                  style={styles.saveBtn}
                  activeOpacity={0.85}
                  onPress={saveChanges}
                >
                  <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.avatarRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.displayName}>{profile.displayName}</Text>
                    {!!profile.username && (
                      <Text style={styles.username}>{profile.username}</Text>
                    )}
                    <Text style={styles.handle}>{profile.handle}</Text>
                    <Text style={styles.email}>{profile.email}</Text>
                    {!!profile.phone && (
                      <Text style={styles.email}>{profile.phone}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.tagRow}>
                  <View style={styles.locationChip}>
                    <Text style={styles.locationText}>{profile.city || '—'}</Text>
                  </View>
                  <View style={styles.sportChip}>
                    <Text style={styles.sportText}>{profile.primarySport || 'SPORT'}</Text>
                  </View>
                </View>

                <View style={styles.tierBadge}>
                  <Text style={styles.tierText}>✓ {profile.tier}</Text>
                </View>

                <TouchableOpacity
                  style={styles.editBtn}
                  activeOpacity={0.85}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.editBtnText}>EDIT PROFILE</Text>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>BADGES</Text>
                <View style={styles.badgeRow}>
                  {(profile.badges || []).map((b) => (
                    <View key={b} style={styles.badge}>
                      <Text style={styles.badgeText}>{b}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>QUICK SETTINGS</Text>
                {['Notifications', 'Privacy', 'Linked Accounts', 'Help'].map((item) => (
                  <TouchableOpacity key={item} style={styles.settingRow} activeOpacity={0.8}>
                    <Text style={styles.settingText}>{item}</Text>
                    <Text style={styles.settingChevron}>›</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.logOutBtn, loggingOut && styles.logOutBtnBusy]}
                  onPress={handleLogOut}
                  activeOpacity={0.85}
                  disabled={loggingOut}
                  accessibilityRole="button"
                  accessibilityLabel="Log out"
                >
                  {loggingOut ? (
                    <ActivityIndicator color={LOGOUT_RED} size="small" />
                  ) : (
                    <Text style={styles.logOutBtnText}>LOG OUT</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mapBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    onClose?.();
                    onOpenSportHubMap?.();
                  }}
                >
                  <Text style={styles.mapBtnText}>SPORT HUB MAP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.passportBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    onClose?.();
                    onOpenPassport?.();
                  }}
                >
                  <Text style={styles.passportBtnText}>OPEN FULL PASSPORT</Text>
                </TouchableOpacity>
              </>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: MUTED,
    marginBottom: 12,
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  close: { color: WHITE, fontSize: 18, fontWeight: '700' },
  formBlock: { paddingBottom: 12 },
  fieldLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
    borderRadius: 10,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: BG, fontSize: 26, fontWeight: '900' },
  meta: { flex: 1 },
  displayName: { color: WHITE, fontSize: 20, fontWeight: '900' },
  username: { color: MUTED, fontSize: 13, fontWeight: '700', marginTop: 2 },
  handle: { color: ACCENT, fontSize: 14, fontWeight: '700', marginTop: 2 },
  email: { color: MUTED, fontSize: 12, marginTop: 4 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  locationChip: {
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  sportChip: {
    backgroundColor: 'rgba(255,87,34,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sportText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  tierText: { color: ACCENT, fontSize: 11, fontWeight: '900' },
  editBtn: {
    backgroundColor: OFF_WHITE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  editBtnText: {
    color: BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badge: {
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: WHITE, fontSize: 11, fontWeight: '800' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  settingText: { color: WHITE, fontSize: 14, fontWeight: '600' },
  settingChevron: { color: MUTED, fontSize: 20, fontWeight: '300' },
  logOutBtn: {
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: LOGOUT_RED,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  logOutBtnBusy: {
    opacity: 0.55,
  },
  logOutBtnText: {
    color: LOGOUT_RED,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mapBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    paddingVertical: 14,
    alignItems: 'center',
  },
  mapBtnText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  passportBtn: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCENT,
    paddingVertical: 14,
    alignItems: 'center',
  },
  passportBtnText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
