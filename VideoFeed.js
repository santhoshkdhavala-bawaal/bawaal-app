import React, { useState, useEffect, Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { resolvePlayableVideoUri } from './src/services/uploadService';

function isPlayableUri(uri) {
  if (uri == null) return false;
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  return (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('content://')
  );
}

class FeedItemErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[VideoFeed] item render error:', error?.message || error);
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.postCard}>
          <Text style={styles.noPostsText}>Unable to load this post.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function PostCard({ item }) {
  const videoUri = resolvePlayableVideoUri(item);
  const playable = isPlayableUri(videoUri);
  const athleteName =
    typeof item?.athleteName === 'string' && item.athleteName.trim()
      ? item.athleteName
      : 'Athlete';
  const sport =
    typeof item?.sport === 'string' && item.sport.trim() ? item.sport : 'ALL';
  const title =
    typeof item?.title === 'string' && item.title.trim()
      ? item.title
      : 'Untitled post';

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.athleteName}>{athleteName}</Text>
        <Text style={styles.sportBadge}>{sport}</Text>
      </View>
      <Text style={styles.postTitle}>{title}</Text>
      <View style={styles.videoPlaceholder}>
        <Text style={styles.videoPlaceholderText}>
          {playable
            ? `📹 Video ready`
            : '📹 No playable video for this post'}
        </Text>
      </View>
    </View>
  );
}

export default function VideoFeed({ route }) {
  const user = route?.params?.user || {
    role: 'fan',
    specializedSport: null,
    name: 'Guest',
  };

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('filtered');
  const [activeFilterName, setActiveFilterName] = useState('');

  const fetchFeed = async () => {
    try {
      setLoading(true);
      let apiUrl = `https://bawaal-app.onrender.com/api/feed?role=${user.role || 'fan'}`;

      if (user.specializedSport) {
        apiUrl += `&specializedSport=${encodeURIComponent(user.specializedSport)}`;
      }

      if (viewMode === 'global') {
        apiUrl += `&view=global`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data?.success && Array.isArray(data.posts)) {
        setPosts(data.posts.filter(Boolean));
        setActiveFilterName(
          typeof data.activeFilter === 'string' ? data.activeFilter : 'Feed'
        );
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await fetchFeed();
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const safeKey = (item, index) => {
    const id = item?._id || item?.id;
    if (id != null && String(id).length > 0) return String(id);
    return `feed-item-${index}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>
            Welcome, {user?.name || 'Guest'}!
          </Text>
          <Text style={styles.roleSubText}>
            Role:{' '}
            <Text style={styles.highlight}>
              {String(user?.role || 'fan').toUpperCase()}
            </Text>
            {user?.role === 'scout' && user?.specializedSport
              ? ` • Specialization: ${user.specializedSport}`
              : ''}
          </Text>
        </View>

        {user?.role === 'scout' && (
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() =>
              setViewMode(viewMode === 'filtered' ? 'global' : 'filtered')
            }
          >
            <Text style={styles.toggleBtnText}>
              {viewMode === 'filtered'
                ? 'Switch to Global'
                : `View ${user.specializedSport || 'Sport'}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.feedBar}>
        <Text style={styles.feedTitle}>Feed: {activeFilterName || '—'}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.noPostsText}>No posts found for this view yet.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={safeKey}
          renderItem={({ item, index }) => (
            <FeedItemErrorBoundary key={safeKey(item, index)}>
              <PostCard item={item} />
            </FeedItemErrorBoundary>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleSubText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  highlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  feedBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noPostsText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  athleteName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  sportBadge: {
    color: '#A3A3A3',
    fontSize: 11,
    fontWeight: '700',
  },
  postTitle: {
    color: '#E5E5E5',
    fontSize: 13,
    marginBottom: 10,
  },
  videoPlaceholder: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  videoPlaceholderText: {
    color: '#A3A3A3',
    fontSize: 12,
    fontWeight: '600',
  },
});
