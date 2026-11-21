/**
 * Root invite listener + WATCH banner (targeted invites only).
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LiveMatchInviteBanner from './LiveMatchInviteBanner';
import {
  subscribeLiveMatchInvites,
  fetchLiveMatch,
  INVITE_TTL_MS,
} from '../services/liveMatchService';
import { getActiveUser } from '../services/activeUserProfile';

function LiveMatchInviteHost({ navigationRef }) {
  const [invite, setInvite] = useState(null);
  const seenRef = useRef(new Set());

  useEffect(() => {
    const user = getActiveUser();
    const unsub = subscribeLiveMatchInvites(user, (payload) => {
      const id = String(payload?.inviteId || payload?.matchId || '');
      if (!id || seenRef.current.has(id)) return;
      seenRef.current.add(id);
      if (seenRef.current.size > 40) {
        seenRef.current = new Set(Array.from(seenRef.current).slice(-20));
      }
      setInvite(payload);
    });
    return () => {
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  // Clear if match ends / invite expires
  useEffect(() => {
    if (!invite?.matchId) return undefined;
    let alive = true;
    const poll = setInterval(() => {
      if (Date.now() > Number(invite.expiresAt || 0)) {
        if (alive) setInvite(null);
        return;
      }
      void fetchLiveMatch(invite.matchId).then((m) => {
        if (!alive) return;
        if (m && m.status === 'ended') setInvite(null);
      });
    }, 8000);
    const hard = setTimeout(() => {
      if (alive) setInvite(null);
    }, INVITE_TTL_MS + 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearTimeout(hard);
    };
  }, [invite]);

  const handleDismiss = useCallback(() => {
    setInvite(null);
  }, []);

  const handleWatch = useCallback(
    async (payload) => {
      const matchId = String(payload?.matchId || '').trim();
      if (!matchId) {
        setInvite(null);
        return;
      }
      let match = null;
      try {
        match = await fetchLiveMatch(matchId);
      } catch (_) {
        match = null;
      }
      setInvite(null);
      try {
        navigationRef?.current?.navigate?.('LiveMatchRoom', {
          matchId,
          match: match || {
            id: matchId,
            sport: payload.sport,
            team_a_name: payload.teamA,
            team_b_name: payload.teamB,
            host_handle: payload.hostHandle,
            has_scoreboard: payload.hasScoreboard !== false,
            status: 'live',
          },
          role: 'viewer',
          isHost: false,
        });
      } catch (_) {
        /* soft-fail navigate */
      }
    },
    [navigationRef]
  );

  return (
    <View style={styles.root} pointerEvents="box-none">
      <LiveMatchInviteBanner
        invite={invite}
        onWatch={handleWatch}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

export default memo(LiveMatchInviteHost);
