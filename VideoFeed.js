import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';

export default function VideoFeed({ route }) {
  // Get user object passed from registration (contains role & specializedSport)
  const user = route?.params?.user || { role: 'fan', specializedSport: null, name: 'Guest' };
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('filtered'); // 'filtered' or 'global'
  const [activeFilterName, setActiveFilterName] = useState('');

  const fetchFeed = async () => {
    try {
      setLoading(true);
      let apiUrl = `https://bawaal-app.onrender.com/api/feed?role=${user.role}`;
      
      if (user.specializedSport) {
        apiUrl += `&specializedSport=${encodeURIComponent(user.specializedSport)}`;
      }

      if (viewMode === 'global') {
        apiUrl += `&view=global`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.success) {
        setPosts(data.posts);
        setActiveFilterName(data.activeFilter);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [viewMode]);

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome, {user.name}!</Text>
          <Text style={styles.roleSubText}>
            Role: <Text style={styles.highlight}>{user.role.toUpperCase()}</Text>
            {user.role === 'scout' && user.specializedSport ? ` • Specialization: ${user.specializedSport}` : ''}
          </Text>
        </View>

        {/* Toggle button for Scouts */}
        {user.role === 'scout' && (
          <TouchableOpacity 
            style={styles.toggleBtn} 
            onPress={() => setViewMode(viewMode === 'filtered' ? 'global' : 'filtered')}
          >
            <Text style={styles.toggleBtnText}>
              {viewMode === 'filtered' ? 'Switch to Global' : `View ${user.specializedSport}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.feedBar}>
        <Text style={styles.feedTitle}>Feed: {activeFilterName}</Text>
      </View>

      {/* Posts List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.noPostsText}>No posts found for this view yet.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                <Text style={styles.athleteName}>{item.athleteName}</Text>
                <Text style={styles.sportBadge}>{item.sport}</Text>
              </View>
              <Text style={styles.postTitle}>{item.title}</Text>
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>📹 Video Stream: {item.videoUrl}</Text>
              </View>
            </View>
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
    fontWeight: 'bold',
    color: '#fff',
  },
  roleSubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  highlight: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  toggleBtn: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  feedBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noPostsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  postCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  athleteName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sportBadge: {
    backgroundColor: '#1e3a8a',
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  postTitle: {
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 12,
  },
  videoPlaceholder: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});