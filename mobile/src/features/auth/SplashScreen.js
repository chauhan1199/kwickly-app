import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

const SplashScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        })
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ])
    ]).start();
  }, [fadeAnim, slideAnim, logoScale, logoOpacity]);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? theme.colors.background : '#F8F8FF' }]}>
      <LinearGradient 
        colors={isDarkMode ? [theme.colors.surface, theme.colors.background] : ['#E6E0FF', '#F8F8FF', '#F8F8FF']} 
        style={StyleSheet.absoluteFill}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 0.5}}
      />

      <View style={styles.topSection}>
        <Animated.View style={[
          styles.logoContainerOuter, 
          { 
            opacity: logoOpacity, 
            transform: [{ scale: logoScale }],
            backgroundColor: '#000'
          }
        ]}>
           <Image source={require('../../assets/images/logo.jpeg')} style={styles.logoImage} />
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#1A1A1A' }]}>Kwic<Text style={{color: '#6C47FF'}}>kly!</Text></Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#A0A0A0' : '#6b7280' }]}>EVERY SERVICE • ANYTIME • NEAR YOU</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.midSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.statCard, { backgroundColor: isDarkMode ? theme.colors.card : '#ffffff' }]}>
          <Text style={[styles.statVal, { color: '#6C47FF' }]}>50+</Text>
          <Text style={[styles.statLbl, { color: isDarkMode ? '#888' : '#888' }]}>CATEGORIES</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: isDarkMode ? theme.colors.card : '#ffffff' }]}>
          <Text style={[styles.statVal, { color: '#6C47FF' }]}>1M+</Text>
          <Text style={[styles.statLbl, { color: isDarkMode ? '#888' : '#888' }]}>USERS</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: isDarkMode ? theme.colors.card : '#ffffff' }]}>
          <Text style={[styles.statVal, { color: '#6C47FF' }]}>4.8☆</Text>
          <Text style={[styles.statLbl, { color: isDarkMode ? '#888' : '#888' }]}>RATING</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.botSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('RoleSelection')} style={{ width: '100%' }}>
          <View style={styles.btn}>
            <Text style={styles.btnText}>Create Account  →</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login', { role: 'CUSTOMER' })}>
          <Text style={[styles.loginLinkText, { color: isDarkMode ? '#A0A0A0' : '#4b5563' }]}>
            Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>

        <Text style={[styles.termsText, { color: isDarkMode ? '#666' : '#9ca3af' }]}>
          By joining, you agree to our Terms of Service and{'\n'}Privacy Policy.
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 100,
  },
  logoContainerOuter: {
    width: 130,
    height: 130,
    borderRadius: 36,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 36,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  midSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  botSection: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  btn: {
    backgroundColor: '#6C47FF',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  loginLinkText: {
    fontSize: 15,
    fontWeight: '400',
  },
  loginLinkBold: {
    fontWeight: '700',
    color: '#6C47FF',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '400',
  }
});

export default SplashScreen;
