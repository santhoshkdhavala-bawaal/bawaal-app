import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isPlayableFeedUri,
  resolveFeedVideoUri,
} from './src/components/SafeFeedVideo';
import ArenaClipPlayer from './src/components/ArenaClipPlayer';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';
const CARD = '#121212';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function ReelPage({ item, index, total, active, labelPrefix }) {
  const uri = resolveFeedVideoUri(item) || resolveFeedVideoUri(item?.videoUri);
  const playable = isPlayableFeedUri(uri);
  const handle =
    item?.creator === 'You'
      ? 'YOU'
      : `@${String(item?.creator || 'athlete').replace(/^@/, '')}`;

  return (
    <View style={styles.page}>
      {playable && active ? (
        <ArenaClipPlayer
          key={`resp-${item?.id || index}-${uri}`}
          uri={uri}
          source={{
            videoUri: item?.videoUri,
            video_url: item?.video_url,
            uri: item?.uri,
            localVideoUri: item?.localVideoUri,
          }}
          style={StyleSheet.absoluteFillObject}
          muted={false}
          loop
          autoPlay
          active={active}
          label={handle}
        />
      ) : playable ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderLabel}>{handle}</Text>
          <Text style={styles.placeholderSub}>SWIPE TO PLAY</Text>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderLabel}>{handle}</Text>
          <Text style={styles.placeholderSub}>RESPONSE CLIP</Text>
        </View>
      )}

      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.metaBlock}>
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
        <Text style={styles.handle}>{handle}</Text>
        <Text style={styles.votes}>{item?.votes ?? 0} VOTES</Text>
        {!!labelPrefix && <Text style={styles.threadHint}>{labelPrefix}</Text>}
      </View>
    </View>
  );
}

/**
 * Full-screen vertical response reel drawer — swipe through every athlete submission.
 */
export default function ResponseReelDrawer({ visible, thread, onClose }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [page, setPage] = useState(0);

  const responses = useMemo(() => {
    const list = [...(thread?.responses || [])];
    return list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  }, [thread?.responses]);

  useEffect(() => {
    if (visible) {
      setPage(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      });
    }
  }, [visible, thread?.id]);

  if (!thread) return null;

  const pageH = SCREEN_H;
  const labelPrefix = `${thread.opponent || 'BATTLE'} · ${thread.target || ''}`.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.topMeta}>
            <Text style={styles.topTitle}>RESPONSES</Text>
            <Text style={styles.topSub} numberOfLines={1}>
              {responses.length} ATHLETE{responses.length === 1 ? '' : 'S'} · SWIPE
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={responses}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageH}
          snapToAlignment="start"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({
            length: pageH,
            offset: pageH * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.y / pageH);
            setPage(Math.max(0, Math.min(responses.length - 1, next)));
          }}
          renderItem={({ item, index }) => (
            <View style={{ height: pageH, width: SCREEN_W }}>
              <ReelPage
                item={item}
                index={index}
                total={responses.length}
                active={visible && index === page}
                labelPrefix={labelPrefix}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { height: pageH }]}>
              <Text style={styles.emptyText}>No responses yet</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0,0.55)',
  },
  topMeta: { flex: 1, paddingRight: 12 },
  topTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  topSub: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
  },
  closeText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  page: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'flex-end',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLabel: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  placeholderSub: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  metaBlock: {
    paddingHorizontal: 18,
    paddingBottom: 48,
  },
  counter: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  handle: {
    color: WHITE,
    fontSize: 24,
    fontWeight: '900',
  },
  votes: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  threadHint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
});
