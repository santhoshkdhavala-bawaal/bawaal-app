import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let AgoraSdk: any = null;
try {
  AgoraSdk = require('react-native-agora');
} catch (e) {
  console.warn('Agora SDK load exception');
}

const RtcSurfaceView = AgoraSdk?.RtcSurfaceView;
const createAgoraRtcEngine = AgoraSdk?.createAgoraRtcEngine;

const AGORA_APP_ID = '256476d4e1db410e9f72b9196287fd29';

// Default Global Challengers Seed
const INITIAL_CHALLENGERS = [
  { id: '1', name: '@MEXICO_TITAN', flag: '🇲🇽', rank: '#1' },
  { id: '2', name: '@BRAZIL_BRAWLER', flag: '🇧🇷', rank: '#2' },
  { id: '3', name: '@SAMURAI_STRIKER', flag: '🇯🇵', rank: '#3' },
  { id: '4', name: '@UK_KNOCKOUT', flag: '🇬🇧', rank: '#4' },
  { id: '5', name: '@US_HEAVYWEIGHT', flag: '🇺🇸', rank: '#5' },
];

export default function ChallengerArena() {
  const insets = useSafeAreaInsets();

  // Mode: 'SPECTATOR' (Watch) vs 'ATHLETE' (Challenge)
  const [viewMode, setViewMode] = useState<'SPECTATOR' | 'ATHLETE'>('SPECTATOR');

  // Camera & Mic Controls
  const [isCamOn, setIsCamOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  // Live Voting State
  const [hostVotes, setHostVotes] = useState(1200);
  const [rivalVotes, setRivalVotes] = useState(1100);

  // Challengers List State
  const [challengersList, setChallengersList] = useState(INITIAL_CHALLENGERS);

  // Modals
  const [showChallengersModal, setShowChallengersModal] = useState(false);
  const [showBanterModal, setShowBanterModal] = useState(false);

  const agoraEngineRef = useRef<any>(null);

  const isAthlete = viewMode === 'ATHLETE';
  const totalVotes = hostVotes + rivalVotes;
  const hostPercent = totalVotes > 0 ? Math.round((hostVotes / totalVotes) * 100) : 50;
  const rivalPercent = 100 - hostPercent;

  useEffect(() => {
    let mounted = true;
    const initEngine = async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        }
        if (createAgoraRtcEngine && AGORA_APP_ID) {
          const engine = createAgoraRtcEngine();
          agoraEngineRef.current = engine;
          engine.initialize({ appId: AGORA_APP_ID });
          engine.enableVideo();
        }
      } catch (err) {
        console.error('Agora init error:', err);
      }
    };
    initEngine();

    return () => {
      mounted = false;
      try {
        agoraEngineRef.current?.stopPreview();
        agoraEngineRef.current?.leaveChannel();
        agoraEngineRef.current?.release();
      } catch (e) {}
    };
  }, []);

  const handleToggleCam = async () => {
    const nextState = !isCamOn;
    const engine = agoraEngineRef.current;
    if (engine) {
      try {
        if (nextState) {
          engine.enableLocalVideo(true);
          engine.startPreview();
        } else {
          engine.stopPreview();
          engine.enableLocalVideo(false);
        }
      } catch (e) {
        console.error('Cam toggle error:', e);
      }
    }
    setIsCamOn(nextState);
  };

  const handleToggleMic = async () => {
    const nextState = !isMicOn;
    const engine = agoraEngineRef.current;
    if (engine) {
      try {
        engine.muteLocalAudioStream(!nextState);
      } catch (e) {}
    }
    setIsMicOn(nextState);
  };

  const handleVoteHost = () => {
    setHostVotes(prev => prev + 1);
  };

  const handleVoteRival = () => {
    setRivalVotes(prev => prev + 1);
  };

  const handleAcceptChallenger = (id: string) => {
    setChallengersList(prev => prev.filter(item => item.id !== id));
  };

  const handleResetQueue = () => {
    setChallengersList(INITIAL_CHALLENGERS);
  };

  return (
    <View style={[styles.rootContainer, { paddingTop: Math.max(insets.top, 12) }]}>
      
      {/* 1. TOP HALF: HOST ARENA */}
      <View style={styles.arenaHalf}>
        {isCamOn && RtcSurfaceView ? (
          <RtcSurfaceView style={styles.fullScreenStream} canvas={{ uid: 0 }} />
        ) : (
          <View style={styles.standbyContainer}>
            <Text style={styles.flagEmoji}>🇮🇳</Text>
            <Text style={styles.handleText}>@MUMBAI_STRIKER</Text>
            <Text style={styles.standbyText}>STANDBY</Text>
          </View>
        )}

        {/* Host Badge & Challengers Queue Button - Top Left */}
        <View style={styles.topLeftGroup}>
          <View style={styles.hostBadge}>
            <Text style={styles.badgeText}>🇮🇳 @MUMBAI_STRIKER</Text>
            <Text style={styles.roleText}>[HOST]</Text>
          </View>

          <TouchableOpacity
            style={styles.challengersBtn}
            onPress={() => setShowChallengersModal(true)}
          >
            <Text style={styles.challengersText}>CHALLENGERS ({challengersList.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Reps Box & Mode Switcher - Top Right */}
        <View style={styles.topRightGroup}>
          <View style={styles.repsBox}>
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsValue}>43</Text>
          </View>
          <TouchableOpacity
            style={[styles.roleSwitchBtn, isAthlete && styles.athleteSwitchActive]}
            onPress={() => setViewMode(m => (m === 'SPECTATOR' ? 'ATHLETE' : 'SPECTATOR'))}
          >
            <Text style={styles.roleSwitchText}>
              {isAthlete ? '⚔️ Athlete Mode' : '👁️ Watch Mode'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. CENTER VS BADGE */}
      <View style={styles.vsContainer}>
        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>

      {/* 3. BOTTOM HALF: RIVAL ARENA */}
      <View style={styles.arenaHalf}>
        <View style={styles.standbyContainer}>
          <Text style={styles.flagEmoji}>🇮🇳</Text>
          <Text style={styles.handleText}>@SANTHOSH</Text>
          <Text style={styles.standbyText}>STANDBY</Text>
        </View>

        {/* Rival Badge & Reps - Top of Bottom Half */}
        <View style={styles.bottomTopInfoRow}>
          <View style={styles.rivalBadge}>
            <Text style={styles.badgeText}>🇮🇳 @SANTHOSH</Text>
            <Text style={styles.roleText}>[RIVAL]</Text>
          </View>
          <View style={styles.repsBox}>
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsValue}>0</Text>
          </View>
        </View>
      </View>

      {/* 4. FOOTER HUD CONTROLS */}
      <View style={[styles.bottomHudWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        
        {/* SPECTATOR (WATCH) MODE HUD */}
        {!isAthlete ? (
          <View style={styles.hudInner}>
            <View style={styles.voteBarWrapper}>
              <Text style={styles.voteTextLeft}>{(hostVotes / 1000).toFixed(1)}K • {hostPercent}%</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${hostPercent}%` }]} />
              </View>
              <Text style={styles.voteTextRight}>{rivalPercent}% • {(rivalVotes / 1000).toFixed(1)}K</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleVoteHost}>
                <Text style={styles.btnText}>🥊 VOTE HOST ({hostVotes})</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.banterBtn} onPress={() => setShowBanterModal(true)}>
                <Text style={styles.btnText}>💬 BANTER</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleVoteRival}>
                <Text style={styles.btnText}>🥊 VOTE RIVAL ({rivalVotes})</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ATHLETE MODE HUD - Camera, Mic & Flip Controls */
          <View style={styles.athleteControlRow}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => agoraEngineRef.current?.switchCamera()}
            >
              <Text style={styles.btnText}>🔄 Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isMicOn && styles.activeControlBtn]}
              onPress={handleToggleMic}
            >
              <Text style={styles.btnText}>{isMicOn ? '🎙️ Mic On' : '🎤 Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isCamOn && styles.activeControlBtn]}
              onPress={handleToggleCam}
            >
              <Text style={styles.btnText}>{isCamOn ? '📹 Cam On' : '📹 Cam Off'}</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* CHALLENGERS QUEUE MODAL SHEET */}
      <Modal visible={showChallengersModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowChallengersModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Challengers Queue</Text>
              {challengersList.length === 0 && (
                <TouchableOpacity style={styles.resetBtn} onPress={handleResetQueue}>
                  <Text style={styles.resetBtnText}>🔄 Reload Queue</Text>
                </TouchableOpacity>
              )}
            </View>

            {challengersList.length > 0 ? (
              <FlatList
                data={challengersList}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={styles.challengerItem}>
                    <Text style={styles.challengerName}>
                      {item.rank} {item.flag} {item.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptChallenger(item.id)}
                    >
                      <Text style={styles.acceptBtnText}>ACCEPT</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.emptyQueueText}>Queue is empty right now!</Text>
            )}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowChallengersModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* BANTER MODAL SHEET */}
      <Modal visible={showBanterModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowBanterModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Live Banter Box</Text>
            <Text style={styles.modalSubtitle}>Drop comments live in the arena!</Text>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowBanterModal(false)}
            >
              <Text style={styles.btnText}>Close Chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#0A0E1A' },
  arenaHalf: { flex: 1, width: '100%', position: 'relative', overflow: 'hidden', borderBottomWidth: 1, borderColor: '#1F293D' },
  fullScreenStream: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  standbyContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E1A', zIndex: 1 },
  flagEmoji: { fontSize: 28, marginBottom: 4, textAlign: 'center' },
  handleText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  standbyText: { color: '#8A99AD', fontSize: 12, marginTop: 2, letterSpacing: 1, textAlign: 'center' },

  topLeftGroup: { position: 'absolute', top: 12, left: 16, zIndex: 10, gap: 6 },
  topRightGroup: { position: 'absolute', top: 12, right: 16, zIndex: 10, alignItems: 'flex-end', gap: 6 },

  bottomTopInfoRow: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  hostBadge: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: '#FF5722', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  rivalBadge: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: '#00BCD4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  roleText: { color: '#FF5722', fontSize: 10, fontWeight: 'bold' },
  repsBox: { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: '#FF5722', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  repsLabel: { color: '#8A99AD', fontSize: 9, fontWeight: 'bold' },
  repsValue: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },

  roleSwitchBtn: { backgroundColor: '#374151', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  athleteSwitchActive: { backgroundColor: '#FF5722' },
  roleSwitchText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  vsContainer: { position: 'absolute', top: '45%', left: '50%', transform: [{ translateX: -20 }, { translateY: -20 }], zIndex: 50 },
  vsCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0A0E1A', borderWidth: 2, borderColor: '#FF5722', justifyContent: 'center', alignItems: 'center' },
  vsText: { color: '#FF5722', fontWeight: 'bold', fontSize: 14 },

  challengersBtn: { backgroundColor: '#00BCD4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  challengersText: { color: '#000000', fontSize: 11, fontWeight: 'bold' },

  bottomHudWrapper: { width: '100%', backgroundColor: '#0A0E1A', paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderColor: '#1F293D' },
  hudInner: { width: '100%' },
  voteBarWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#00BCD4', marginHorizontal: 8, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FF5722' },
  voteTextLeft: { color: '#FF5722', fontSize: 11, fontWeight: 'bold' },
  voteTextRight: { color: '#00BCD4', fontSize: 11, fontWeight: 'bold' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#1F293D', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  banterBtn: { backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },

  athleteControlRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(15, 23, 42, 0.95)', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  controlBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1F293D', alignItems: 'center' },
  activeControlBtn: { backgroundColor: '#FF5722' },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E293B', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '50%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 16 },
  resetBtn: { backgroundColor: '#374151', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  resetBtnText: { color: '#00BCD4', fontSize: 12, fontWeight: 'bold' },
  emptyQueueText: { color: '#94A3B8', textAlign: 'center', marginVertical: 20 },
  challengerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  challengerName: { color: '#FFFFFF', fontWeight: 'bold' },
  acceptBtn: { backgroundColor: '#00BCD4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  acceptBtnText: { color: '#000000', fontSize: 10, fontWeight: 'bold' },
  closeModalBtn: { backgroundColor: '#FF5722', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 14 },
});