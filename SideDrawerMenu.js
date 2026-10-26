/**
 * BAWAAL left-sliding social drawer — profile, following, suggested, footer.
 * Uses RN Animated (no Reanimated dependency) for a smooth Android-safe slide.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './theme';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(320, Math.round(SCREEN_W * 0.82));

const DEFAULT_USER = {
  displayName: 'Rohit Kumar',
  handle: '@rohit_vk7',
  statusBadge: 'PRO Subscriber',
  avatarUri: null,
  initials: 'RK',
};

const DEFAULT_FOLLOWING = [
  {
    id: 'f1',
    name: 'Mia Torque',
    handle: '@Mia_Torque',
    sport: 'GYM',
    online: true,
    avatarUri: null,
  },
  {
    id: 'f2',
    name: 'Aman Strike',
    handle: '@Aman_Combat',
    sport: 'COMBAT',
    online: false,
    avatarUri: null,
  },
  {
    id: 'f3',
    name: 'Rohit Bat',
    handle: '@Rohit_Cricket',
    sport: 'CRICKET',
    online: true,
    avatarUri: null,
  },
];

const DEFAULT_SUGGESTED = [
  {
    id: 's1',
    name: 'Karan FreeKick',
    handle: '@Karan_FreeKick',
    sport: 'FOOTBALL',
    avatarUri: null,
  },
  {
    id: 's2',
    name: 'RaceQueen IN',
    handle: '@RaceQueen_IN',
    sport: 'THROTTLE',
    avatarUri: null,
  },
  {
    id: 's3',
    name: 'Yuki Power',
    handle: '@Yuki_Lift',
    sport: 'GYM',
    avatarUri: null,
  },
];

function Avatar({ uri, initials, size = 44 }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.SURFACE,
        }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,87,34,0.22)',
        borderWidth: 1,
        borderColor: 'rgba(255,87,34,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={styles.avatarInitials}>
        {(initials || '?').slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function PersonRow({
  person,
  trailing,
}) {
  const initials =
    person.initials ||
    String(person.name || person.handle || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2);

  return (
    <View style={styles.personRow}>
      <View style={styles.personLeft}>
        <View>
          <Avatar uri={person.avatarUri} initials={initials} size={42} />
          {person.online ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.personName} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.personHandle} numberOfLines={1}>
            {person.handle}
          </Text>
        </View>
      </View>
      <View style={styles.personRight}>
        {person.sport ? (
          <View style={styles.sportChip}>
            <Text style={styles.sportChipText}>{person.sport}</Text>
          </View>
        ) : null}
        {trailing}
      </View>
    </View>
  );
}

/**
 * @param {{
 *   visible: boolean,
 *   onClose: () => void,
 *   user?: typeof DEFAULT_USER,
 *   following?: typeof DEFAULT_FOLLOWING,
 *   suggested?: typeof DEFAULT_SUGGESTED,
 *   onInviteFriends?: () => void,
 *   onOpenSettings?: () => void,
 *   onOpenHelp?: () => void,
 *   onFollowChange?: (id: string, following: boolean) => void,
 * }} props
 */
function SideDrawerMenu({
  visible,
  onClose,
  user = DEFAULT_USER,
  following = DEFAULT_FOLLOWING,
  suggested = DEFAULT_SUGGESTED,
  onInviteFriends,
  onOpenSettings,
  onOpenHelp,
  onFollowChange,
}) {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const [followedIds, setFollowedIds] = useState(() => new Set());

  const runOpenAnimation = useCallback(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-DRAWER_W, 0],
      }),
    [progress]
  );

  const toggleFollow = useCallback(
    (id) => {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        const nowFollowing = !next.has(id);
        if (nowFollowing) next.add(id);
        else next.delete(id);
        onFollowChange?.(id, nowFollowing);
        return next;
      });
    },
    [onFollowChange]
  );

  const profile = useMemo(
    () => ({
      ...DEFAULT_USER,
      ...user,
      initials:
        user?.initials ||
        String(user?.displayName || 'U')
          .split(/\s+/)
          .map((p) => p[0])
          .join('')
          .slice(0, 2),
    }),
    [user]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={runOpenAnimation}
      onRequestClose={onClose}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_W,
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <Avatar
              uri={profile.avatarUri}
              initials={profile.initials}
              size={56}
            />
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.displayName}
              </Text>
              <Text style={styles.profileHandle} numberOfLines={1}>
                {profile.handle}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{profile.statusBadge}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close drawer"
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <SectionTitle>People You Follow</SectionTitle>
            {following.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}

            <View style={styles.divider} />

            <SectionTitle>Suggested Athletes</SectionTitle>
            {suggested.map((person) => {
              const isFollowing = followedIds.has(person.id);
              return (
                <PersonRow
                  key={person.id}
                  person={person}
                  trailing={
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        isFollowing && styles.followBtnOn,
                      ]}
                      onPress={() => toggleFollow(person.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.followBtnText,
                          isFollowing && styles.followBtnTextOn,
                        ]}
                      >
                        {isFollowing ? 'Following' : '+ Follow'}
                      </Text>
                    </TouchableOpacity>
                  }
                />
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerBtn}
              activeOpacity={0.85}
              onPress={() => {
                onInviteFriends?.();
                onClose();
              }}
            >
              <Text style={styles.footerBtnText}>Invite friends to follow</Text>
            </TouchableOpacity>
            <View style={styles.footerRow}>
              <TouchableOpacity
                onPress={() => {
                  onOpenSettings?.();
                  onClose();
                }}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Settings</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>·</Text>
              <TouchableOpacity
                onPress={() => {
                  onOpenHelp?.();
                  onClose();
                }}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Help & Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  // drawer panel sits above backdrop via absolute + elevation
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.BACKGROUND_DEEP,
    borderRightWidth: 1,
    borderRightColor: COLORS.BORDER_DIM,
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.BORDER_DIM,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: COLORS.WHITE,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  profileHandle: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,87,34,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,87,34,0.55)',
  },
  badgeText: {
    color: COLORS.ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closeX: {
    color: COLORS.TEXT_MUTED,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  avatarInitials: {
    color: COLORS.ACCENT,
    fontWeight: '900',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionTitle: {
    color: COLORS.OFF_WHITE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 10,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 8,
  },
  personLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  personMeta: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  personHandle: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  personRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: COLORS.BACKGROUND_DEEP,
  },
  sportChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_DIM,
    backgroundColor: COLORS.SURFACE,
  },
  sportChipText: {
    color: COLORS.OFF_WHITE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
    backgroundColor: 'transparent',
  },
  followBtnOn: {
    backgroundColor: 'rgba(255,87,34,0.18)',
    borderColor: 'rgba(255,87,34,0.55)',
  },
  followBtnText: {
    color: COLORS.ACCENT,
    fontSize: 11,
    fontWeight: '800',
  },
  followBtnTextOn: {
    color: COLORS.OFF_WHITE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.BORDER_DIM,
    marginTop: 14,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.BORDER_DIM,
    paddingTop: 12,
    gap: 12,
  },
  footerBtn: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  footerBtnText: {
    color: COLORS.WHITE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  footerLink: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  footerDot: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
  },
});

export default memo(SideDrawerMenu);
export { DEFAULT_USER, DEFAULT_FOLLOWING, DEFAULT_SUGGESTED, DRAWER_W };
