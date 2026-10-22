import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { COLORS } from './theme';

/**
 * In-app splash — mirrors native splash_v2.png / #000000 branding.
 */
export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      if (navigation?.replace) {
        navigation.replace('AthleteRegistration');
      } else if (navigation?.navigate) {
        navigation.navigate('Arena');
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" hidden />
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('./assets/splash_v2.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  splashImage: {
    width: '100%',
    height: '70%',
    maxWidth: 420,
  },
});
