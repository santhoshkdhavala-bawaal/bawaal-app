/**
 * Web-only clip capture via MediaRecorder.
 * expo-camera's web `record()` is a no-op that returns `{ uri: '' }` — this
 * records the live CameraView MediaStream until stop or maxDuration.
 */

/** @type {{
 *   recorder: MediaRecorder,
 *   chunks: Blob[],
 *   mimeType: string,
 *   resolve: (v: { uri: string }) => void,
 *   reject: (e: Error) => void,
 *   timer: ReturnType<typeof setTimeout> | null,
 *   settled: boolean,
 * } | null} */
let activeSession = null;

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Prefer the live CameraView <video> MediaStream (do not open a second getUserMedia).
 * @returns {MediaStream | null}
 */
export function findLiveCameraStream() {
  if (typeof document === 'undefined') return null;
  const videos = Array.from(document.querySelectorAll('video'));
  for (const el of videos) {
    const stream = el?.srcObject;
    if (
      stream &&
      typeof stream.getVideoTracks === 'function' &&
      stream.getVideoTracks().length > 0
    ) {
      return stream;
    }
  }
  return null;
}

export function isWebMediaRecorderAvailable() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices
  );
}

function settleSession(result, error) {
  const session = activeSession;
  if (!session || session.settled) return;
  session.settled = true;
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  activeSession = null;
  if (error) session.reject(error);
  else session.resolve(result || { uri: '' });
}

/**
 * Stop the active MediaRecorder (if any). Does NOT stop camera tracks.
 */
export function stopWebClipRecording() {
  const session = activeSession;
  if (!session) return;
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  try {
    if (session.recorder.state !== 'inactive') {
      session.recorder.stop();
    } else if (!session.settled) {
      // Already inactive with no onstop — finalize empty
      settleSession({ uri: '' }, null);
    }
  } catch (err) {
    settleSession(null, err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Abort without producing a URI (retake / unmount).
 * Resolves empty so awaiters do not throw into sample-fallback publish.
 */
export function abortWebClipRecording() {
  const session = activeSession;
  if (!session) return;
  session.settled = true;
  if (session.timer) clearTimeout(session.timer);
  try {
    if (session.recorder.state !== 'inactive') session.recorder.stop();
  } catch {
    /* ignore */
  }
  activeSession = null;
  try {
    session.resolve({ uri: '' });
  } catch {
    /* ignore */
  }
}

/**
 * Start recording the live camera stream.
 * Promise resolves with `{ uri }` (blob:) when stopped or maxDuration elapses.
 *
 * @param {{ maxDurationSec?: number, stream?: MediaStream | null }} [opts]
 * @returns {Promise<{ uri: string }>}
 */
export function startWebClipRecording(opts = {}) {
  if (activeSession) {
    stopWebClipRecording();
  }

  return new Promise((resolve, reject) => {
    if (!isWebMediaRecorderAvailable()) {
      reject(new Error('MediaRecorder is not available in this browser'));
      return;
    }

    const stream = opts.stream || findLiveCameraStream();
    if (!stream) {
      reject(new Error('No live camera MediaStream to record'));
      return;
    }

    const mimeType = pickRecorderMimeType();
    const chunks = [];
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
        : new MediaRecorder(stream, { videoBitsPerSecond: 2_500_000 });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const session = {
      recorder,
      chunks,
      mimeType: mimeType || recorder.mimeType || 'video/webm',
      resolve,
      reject,
      timer: null,
      settled: false,
    };
    activeSession = session;

    recorder.ondataavailable = (event) => {
      if (event?.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      const msg =
        event?.error?.message ||
        event?.message ||
        'MediaRecorder error';
      settleSession(null, new Error(String(msg)));
    };

    recorder.onstop = () => {
      try {
        if (!chunks.length) {
          settleSession({ uri: '' }, null);
          return;
        }
        const blob = new Blob(chunks, { type: session.mimeType });
        const uri = URL.createObjectURL(blob);
        settleSession({ uri }, null);
      } catch (err) {
        settleSession(
          null,
          err instanceof Error ? err : new Error(String(err))
        );
      }
    };

    try {
      // Timeslice keeps chunks flowing so stop always has data
      recorder.start(250);
    } catch (err) {
      activeSession = null;
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const maxSec = Number(opts.maxDurationSec) || 0;
    if (maxSec > 0) {
      session.timer = setTimeout(() => {
        stopWebClipRecording();
      }, Math.round(maxSec * 1000));
    }
  });
}
