/**
 * FilmStripTrimmer — independent PanResponders for:
 *  1) white playhead scrub (seek only)
 *  2) red slow-mo interval (start/end only)
 * Gestures never share one responder, so the strip does not jitter as a unit.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';

const ACCENT = '#FFFFFF';
const SLOWMO_RED = '#FF3B30';
const MIN_TRIM_SPAN = 0.5;
const HANDLE_HIT = 22;
const PLAYHEAD_HIT = 28;

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

type FilmNode = {
  measureInWindow: (
    cb: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

export type FilmStripTrimmerProps = {
  duration: number;
  startSec: number;
  endSec: number;
  playheadSec: number;
  onChangeRange: (start: number, end: number, commit: boolean) => void;
  onSeekPlayhead?: (sec: number, commit: boolean) => void;
};

export default function FilmStripTrimmer({
  duration,
  startSec,
  endSec,
  playheadSec,
  onChangeRange,
  onSeekPlayhead,
}: FilmStripTrimmerProps) {
  /* eslint-disable react-hooks/refs */
  const originXRef = useRef(0);
  const widthRef = useRef(1);
  const durationRef = useRef(duration);
  const rangePropsRef = useRef({ startSec, endSec });
  const playheadPropRef = useRef(playheadSec);
  const onChangeRangeRef = useRef(onChangeRange);
  const onSeekRef = useRef(onSeekPlayhead);
  const localStartRef = useRef(startSec);
  const localEndRef = useRef(endSec);
  const localPlayheadRef = useRef(playheadSec);
  const rangeKindRef = useRef<'start' | 'end' | null>(null);
  const filmNodeRef = useRef<FilmNode | null>(null);

  const [stripWidth, setStripWidth] = useState(1);
  const [rangePreview, setRangePreview] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    rangePropsRef.current = { startSec, endSec };
    if (rangeKindRef.current) return;
    localStartRef.current = startSec;
    localEndRef.current = endSec;
  }, [startSec, endSec]);

  useEffect(() => {
    playheadPropRef.current = playheadSec;
    if (scrubPreview != null) return;
    localPlayheadRef.current = playheadSec;
  }, [playheadSec, scrubPreview]);

  useEffect(() => {
    onChangeRangeRef.current = onChangeRange;
  }, [onChangeRange]);

  useEffect(() => {
    onSeekRef.current = onSeekPlayhead;
  }, [onSeekPlayhead]);

  const pageXToSec = useCallback((pageX: number) => {
    const w = Math.max(1, widthRef.current);
    const maxDur = Math.max(MIN_TRIM_SPAN, durationRef.current || 1);
    const locX = Math.max(0, Math.min(w, pageX - originXRef.current));
    return Math.max(0, Math.min(maxDur, (locX / w) * maxDur));
  }, []);

  const measureStrip = useCallback(() => {
    filmNodeRef.current?.measureInWindow((x: number, _y: number, w: number) => {
      const nextW = Math.max(1, w);
      originXRef.current = x;
      widthRef.current = nextW;
      setStripWidth((prev) => (Math.abs(prev - nextW) > 0.5 ? nextW : prev));
    });
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.max(1, e.nativeEvent.layout.width);
      widthRef.current = w;
      setStripWidth(w);
      measureStrip();
    },
    [measureStrip]
  );

  /** Red interval only — never touches playhead. */
  const [rangeHandlers] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        measureStrip();
        const { startSec: s0, endSec: e0 } = rangePropsRef.current;
        localStartRef.current = s0;
        localEndRef.current = e0;
        const w = Math.max(1, widthRef.current);
        const maxDur = Math.max(MIN_TRIM_SPAN, durationRef.current || 1);
        const locX = Math.max(
          0,
          Math.min(w, evt.nativeEvent.pageX - originXRef.current)
        );
        const startX = (s0 / maxDur) * w;
        const endX = (e0 / maxDur) * w;
        const distStart = Math.abs(locX - startX);
        const distEnd = Math.abs(locX - endX);
        rangeKindRef.current =
          distStart <= distEnd || locX < (startX + endX) / 2 ? 'start' : 'end';
        setRangePreview({ start: s0, end: e0 });
      },
      onPanResponderMove: (evt) => {
        if (!rangeKindRef.current) return;
        const sec = pageXToSec(evt.nativeEvent.pageX);
        const maxDur = Math.max(MIN_TRIM_SPAN, durationRef.current || 1);
        if (rangeKindRef.current === 'start') {
          const next = Math.max(
            0,
            Math.min(sec, localEndRef.current - MIN_TRIM_SPAN)
          );
          localStartRef.current = next;
          setRangePreview({ start: next, end: localEndRef.current });
        } else {
          const next = Math.min(
            maxDur,
            Math.max(sec, localStartRef.current + MIN_TRIM_SPAN)
          );
          localEndRef.current = next;
          setRangePreview({ start: localStartRef.current, end: next });
        }
      },
      onPanResponderRelease: () => {
        rangeKindRef.current = null;
        const s = localStartRef.current;
        const e = localEndRef.current;
        setRangePreview(null);
        onChangeRangeRef.current(s, e, true);
      },
      onPanResponderTerminate: () => {
        rangeKindRef.current = null;
        const s = localStartRef.current;
        const e = localEndRef.current;
        setRangePreview(null);
        onChangeRangeRef.current(s, e, true);
      },
    }).panHandlers
  );

  /** White scrub head only — never moves the red interval. */
  const [scrubHandlers] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        measureStrip();
        const sec = pageXToSec(evt.nativeEvent.pageX);
        localPlayheadRef.current = sec;
        setScrubPreview(sec);
        onSeekRef.current?.(sec, false);
      },
      onPanResponderMove: (evt) => {
        const sec = pageXToSec(evt.nativeEvent.pageX);
        localPlayheadRef.current = sec;
        setScrubPreview(sec);
        onSeekRef.current?.(sec, false);
      },
      onPanResponderRelease: () => {
        const sec = localPlayheadRef.current;
        setScrubPreview(null);
        onSeekRef.current?.(sec, true);
      },
      onPanResponderTerminate: () => {
        const sec = localPlayheadRef.current;
        setScrubPreview(null);
        onSeekRef.current?.(sec, true);
      },
    }).panHandlers
  );
  /* eslint-enable react-hooks/refs */

  const displayStart = rangePreview?.start ?? startSec;
  const displayEnd = rangePreview?.end ?? endSec;
  const displayPlayhead = scrubPreview ?? playheadSec;
  const dur = Math.max(MIN_TRIM_SPAN, duration || 1);
  const w = Math.max(1, stripWidth);
  const leftPx = Math.round((displayStart / dur) * w);
  const rightPx = Math.round((displayEnd / dur) * w);
  const selWidth = Math.max(12, rightPx - leftPx);
  const playPx = Math.round((displayPlayhead / dur) * w);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Drag red box for slow-mo · white cursor seeks playhead
      </Text>
      <View
        ref={(node) => {
          filmNodeRef.current = node as unknown as FilmNode | null;
        }}
        style={styles.film}
        onLayout={onLayout}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <View
            key={`f-${i}`}
            pointerEvents="none"
            style={[styles.frame, i % 2 === 0 ? styles.frameA : styles.frameB]}
          />
        ))}

        {/* Red slow-mo interval — dedicated PanResponder */}
        <View
          style={[styles.selection, { left: leftPx, width: selWidth }]}
          {...rangeHandlers}
        >
          <View style={[styles.handle, styles.handleLeft]} pointerEvents="none">
            <View style={styles.handleBar} />
          </View>
          <View style={[styles.handle, styles.handleRight]} pointerEvents="none">
            <View style={styles.handleBar} />
          </View>
        </View>

        {/* White scrub head — dedicated PanResponder (higher zIndex) */}
        <View
          style={[
            styles.playheadHit,
            { left: Math.max(0, playPx - PLAYHEAD_HIT / 2) },
          ]}
          {...scrubHandlers}
        >
          <View style={styles.playhead} pointerEvents="none" />
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{formatClock(displayStart)}</Text>
        <Text style={styles.labelAccent}>SLOW-MO</Text>
        <Text style={styles.label}>{formatClock(displayEnd)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 8 },
  hint: {
    color: '#A3A3A3',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  film: {
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  frame: { flex: 1, borderRightWidth: 1, borderRightColor: '#1A1A1A' },
  frameA: { backgroundColor: '#141414' },
  frameB: { backgroundColor: '#0F0F0F' },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,59,48,0.32)',
    borderColor: SLOWMO_RED,
    borderWidth: 2,
    zIndex: 2,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLeft: { left: -2 },
  handleRight: { right: -2 },
  handleBar: {
    width: 4,
    height: '72%',
    borderRadius: 2,
    backgroundColor: SLOWMO_RED,
  },
  playheadHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: PLAYHEAD_HIT,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playhead: {
    width: 2,
    height: '100%',
    backgroundColor: ACCENT,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: { color: '#A3A3A3', fontSize: 10, fontWeight: '700' },
  labelAccent: { color: SLOWMO_RED, fontSize: 10, fontWeight: '900' },
});
