/**
 * Confirm Report / Block via Alert, then persist through reelSocialService.
 */
import { Alert, Platform } from 'react-native';
import { dispatchReelSocialAction } from '../services/reelSocialService';

function notify(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/**
 * @param {string} actionId
 * @param {object} reel
 * @returns {boolean} true if handled (report/block)
 */
export function handleModerationAction(actionId, reel) {
  const id = String(actionId || '').toLowerCase();
  if (id !== 'report' && id !== 'block') return false;

  const handle = String(
    reel?.handle || reel?.author || reel?.username || 'this athlete'
  ).replace(/^@/, '');

  if (id === 'report') {
    const run = () => {
      void dispatchReelSocialAction('report', reel, {
        reason: 'inappropriate',
      })
        .then(() =>
          notify(
            'Report submitted',
            'Thanks — our team will review this content.'
          )
        )
        .catch((err) =>
          notify('Report failed', err?.message || 'Could not submit report.')
        );
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Report @${handle}'s content as inappropriate?`)) run();
      return true;
    }
    Alert.alert('Report content', `Report @${handle}'s content as inappropriate?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: run },
    ]);
    return true;
  }

  const runBlock = () => {
    void dispatchReelSocialAction('block', reel, { reason: 'user_block' })
      .then(() =>
        notify(
          'User blocked',
          `@${handle} is blocked on this device. You can still leave the Arena anytime.`
        )
      )
      .catch((err) =>
        notify('Block failed', err?.message || 'Could not block user.')
      );
  };
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
    if (window.confirm(`Block @${handle}? You will no longer see their content.`)) {
      runBlock();
    }
    return true;
  }
  Alert.alert('Block user', `Block @${handle}? You will no longer see their content.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: runBlock },
  ]);
  return true;
}
