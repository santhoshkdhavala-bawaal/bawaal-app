import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import ChallengeCam from './ChallengeCam';

const ORANGE = '#FF6B00';
const CANVAS = '#050505';
const SURFACE = '#0A0A0C';

/**
 * Arena challenge route — hosts CameraView via ChallengeCam.
 * Emulator-safe: ChallengeCam falls back if native camera fails.
 * Expects route.params.reel = { creator, statSticker, ... }
 */
export default function ChallengeScreen({ route, navigation }) {
  const reel = route?.params?.reel;
  const [resultModal, setResultModal] = useState(null);

  const handleClose = useCallback(() => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      navigation?.navigate?.('Arena');
    } catch (error) {
      console.warn('ChallengeScreen close failed:', error?.message || error);
    }
  }, [navigation]);

  const postToArena = useCallback(
    (uri, isMock) => {
      try {
        if (navigation?.navigate) {
          navigation.navigate('Arena', {
            recordedUri: uri,
            reel,
            isMockClip: isMock,
          });
        } else {
          handleClose();
        }
      } catch (navError) {
        console.warn('Post navigation failed:', navError?.message || navError);
        handleClose();
      }
    },
    [navigation, reel, handleClose]
  );

  const handleVideoCaptured = useCallback((uri, meta = {}) => {
    const isMock =
      meta?.isMock || (typeof uri === 'string' && uri.startsWith('emulator-mock://'));
    setResultModal({
      uri,
      isMock,
      title: isMock ? 'FALLBACK CLIP READY' : 'CHALLENGE RECORDED',
      body: isMock
        ? 'Emulator camera was unavailable, so a safe placeholder clip was created. Post it to continue the flow.'
        : 'Your battle response is ready for the arena.',
    });
  }, []);

  const dismissModal = () => setResultModal(null);

  return (
    <>
      <ChallengeCam
        route={route}
        navigation={navigation}
        targetUser={reel?.creator || route?.params?.handle || 'Yuki_Lift'}
        challengeTarget={reel?.statSticker || route?.params?.target || '140 KG x 3 Reps'}
        onClose={handleClose}
        onVideoCaptured={handleVideoCaptured}
      />

      <Modal
        visible={!!resultModal}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={dismissModal}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.logoWrap}>
              <Image
                source={require('./assets/BAWAAL_white_icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>{resultModal?.title}</Text>
            <Text style={styles.body}>{resultModal?.body}</Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                const payload = resultModal;
                dismissModal();
                if (payload?.uri) {
                  postToArena(payload.uri, payload.isMock);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>POST TO ARENA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stayBtn} activeOpacity={0.7} onPress={dismissModal}>
              <Text style={styles.stayBtnText}>STAY</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.82)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  logoWrap: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    height: 50,
    width: '100%',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: CANVAS,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  stayBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stayBtnText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
