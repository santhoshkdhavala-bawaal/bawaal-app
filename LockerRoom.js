import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import BrandHeader from './BrandHeader';
import { useMainTabs } from './mainTabContext';

const OBSIDIAN = '#000000';
const CREAM = '#F4F1DE';
const FLAME_RED = '#FF4D4D';
const EARTHY = '#D4A373';
const SAGE = '#E8ECE9';
const SLATE_BRONZE = '#A0A0A0';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(232,236,233,0.28)';
const CARD = '#121212';

const SQUAD_ROOMS = [
  {
    id: 'squad-iron',
    name: 'Iron Circle',
    members: 6,
    privacy: 'INVITE ONLY',
    last: 'Coach: Film tomorrow 6AM.',
    unread: 2,
    tint: EARTHY,
  },
  {
    id: 'squad-south',
    name: 'South Turf Unit',
    members: 4,
    privacy: 'INVITE ONLY',
    last: 'Aarav: New battle brief dropped.',
    unread: 0,
    tint: SAGE,
  },
  {
    id: 'squad-night',
    name: 'Night Shift Athletics',
    members: 8,
    privacy: 'INVITE ONLY',
    last: 'Mia: Bring chalk + straps.',
    unread: 5,
    tint: SLATE_BRONZE,
  },
];

const MATCH_ROOMS = [
  {
    id: 'match-ind-aus',
    name: 'IND vs AUS · Pre-Match',
    sides: 'HOME vs AWAY',
    kickoff: 'TONIGHT 19:30',
    last: 'Away: “Bring the heat.”',
    heat: 92,
    rivalry: true,
  },
  {
    id: 'match-mum-del',
    name: 'MUM vs DEL · Rivalry Room',
    sides: 'BLUE vs RED',
    kickoff: 'SAT 16:00',
    last: 'Home: Captain call in 10.',
    heat: 78,
    rivalry: true,
  },
  {
    id: 'match-lift-wars',
    name: 'Lift Wars · Team Banter',
    sides: 'SQUAD A vs SQUAD B',
    kickoff: 'LIVE NOW',
    last: '24 athletes trading clips',
    heat: 99,
    rivalry: true,
  },
];

export default function LockerRoom() {
  const { openProfileGateway, openSideDrawer } = useMainTabs();
  const [roomMode, setRoomMode] = useState('squad');
  const [query, setQuery] = useState('');

  const rooms = useMemo(() => {
    const list = roomMode === 'squad' ? SQUAD_ROOMS : MATCH_ROOMS;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q));
  }, [roomMode, query]);

  return (
    <View style={styles.container}>
      <BrandHeader
        screenName="LOCKER ROOM"
        onBrandPress={openProfileGateway}
        onMenuPress={openSideDrawer}
      />

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modePill, roomMode === 'squad' && styles.modePillSquad]}
          onPress={() => setRoomMode('squad')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeText, roomMode === 'squad' && styles.modeTextDark]}>
            MY SQUAD
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modePill, roomMode === 'match' && styles.modePillMatch]}
          onPress={() => setRoomMode('match')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeText, roomMode === 'match' && styles.modeTextOnRed]}>
            MATCH ROOMS
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.modeHint}>
        {roomMode === 'squad'
          ? 'Private invite-only team chats for your inner circle.'
          : 'Pre-match team vs team rivalry banter rooms.'}
      </Text>

      <TextInput
        style={styles.search}
        placeholder={roomMode === 'squad' ? 'Search squad rooms' : 'Search match rooms'}
        placeholderTextColor={MUTED}
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {rooms.map((room) =>
          roomMode === 'squad' ? (
            <TouchableOpacity
              key={room.id}
              style={[styles.card, { borderColor: room.tint, backgroundColor: `${room.tint}22` }]}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{room.name}</Text>
                <View style={[styles.privacyBadge, { borderColor: room.tint }]}>
                  <Text style={[styles.privacyText, { color: room.tint }]}>{room.privacy}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>{room.members} members</Text>
              <Text style={styles.cardLast} numberOfLines={1}>
                {room.last}
              </Text>
              {room.unread > 0 && (
                <View style={[styles.unreadPill, { borderColor: room.tint }]}>
                  <Text style={[styles.unreadText, { color: room.tint }]}>{room.unread} NEW</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={room.id}
              style={[styles.matchCard, room.rivalry && styles.matchCardHot]}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{room.name}</Text>
                <View style={styles.heatBadge}>
                  <Text style={styles.heatText}>{room.heat}° HEAT</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {room.sides} · {room.kickoff}
              </Text>
              <Text style={styles.cardLast} numberOfLines={1}>
                {room.last}
              </Text>
              {room.rivalry && (
                <View style={styles.rivalryTag}>
                  <Text style={styles.rivalryTagText}>RIVALRY</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
          <Text style={styles.createBtnText}>
            {roomMode === 'squad' ? '+ CREATE SQUAD ROOM' : '+ OPEN MATCH ROOM'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OBSIDIAN },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  modePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
  },
  modePillSquad: {
    backgroundColor: CREAM,
    borderColor: CREAM,
  },
  modePillMatch: {
    backgroundColor: FLAME_RED,
    borderColor: FLAME_RED,
  },
  modeText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modeTextDark: { color: OBSIDIAN },
  modeTextOnRed: { color: WHITE },
  modeHint: {
    color: MUTED,
    fontSize: 11,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: WHITE,
    fontSize: 13,
  },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  matchCard: {
    backgroundColor: '#121212',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  matchCardHot: {
    borderColor: FLAME_RED,
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  privacyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  privacyText: { fontSize: 9, fontWeight: '900' },
  heatBadge: {
    backgroundColor: 'rgba(255, 77, 77, 0.18)',
    borderWidth: 1,
    borderColor: FLAME_RED,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heatText: { color: FLAME_RED, fontSize: 10, fontWeight: '900' },
  cardMeta: { color: MUTED, fontSize: 11, marginTop: 6 },
  cardLast: { color: WHITE, fontSize: 12, marginTop: 6 },
  unreadPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  unreadText: { fontSize: 10, fontWeight: '900' },
  rivalryTag: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: FLAME_RED,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rivalryTagText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  createBtn: {
    marginTop: 8,
    backgroundColor: CREAM,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: {
    color: OBSIDIAN,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
