import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

const SplashScreen = ({ navigation }) => {
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
    <LinearGradient 
      colors={['#0a1628', '#0e2040', '#071520']} 
      style={styles.container}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%">
          <Defs>
            <SvgRadialGradient id="grad1" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#0e9aa7" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#0e9aa7" stopOpacity="0" />
            </SvgRadialGradient>
            <SvgRadialGradient id="grad2" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#43e3eb" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#43e3eb" stopOpacity="0" />
            </SvgRadialGradient>
            <SvgRadialGradient id="grad3" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#7ed957" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#7ed957" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Circle cx="100%" cy="0" r="150" fill="url(#grad1)" />
          <Circle cx="0" cy="80%" r="130" fill="url(#grad2)" />
          <Circle cx="40%" cy="40%" r="90" fill="url(#grad3)" />
        </Svg>
      </View>

      <View style={styles.topSection}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
           <Image source={require('../../assets/images/logo.jpeg')} style={styles.logoImage} />
        </Animated.View>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <Text style={styles.title}>KWIC<Text style={{color: '#43e3eb'}}>KLY</Text></Text>
          <Text style={styles.subtitle}>EVERY SERVICE • ANYTIME • NEAR YOU</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.midSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.stat}><Text style={styles.statVal}>50+</Text><Text style={styles.statLbl}>CATEGORIES</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.statVal}>1M+</Text><Text style={styles.statLbl}>USERS</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.statVal}>4.8★</Text><Text style={styles.statLbl}>RATING</Text></View>
      </Animated.View>

      <Animated.View style={[styles.botSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('RoleSelection')}>
          <LinearGradient colors={['#0e9aa7', '#43e3eb']} style={styles.btn} start={{x:0, y:0}} end={{x:1, y:1}}>
            <Text style={styles.btnText}>Create Account →</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login', { role: 'CUSTOMER' })}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 36,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 80,
  },
  logoWrap: {
    width: 110,
    height: 110,
    backgroundColor: '#0b0b0a',
    borderRadius: 28,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(67,227,235,.35)',
    shadowColor: '#43e3eb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,.6)',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  midSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#43e3eb',
  },
  statLbl: {
    fontSize: 10,
    color: 'rgba(255,255,255,.5)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  botSection: {
    width: '100%',
    paddingHorizontal: 24,
  },
  btn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0e9aa7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: '#001016',
    fontWeight: '800',
    fontSize: 16,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 18,
  },
  loginLinkText: {
    color: 'rgba(255,255,255,.5)',
    fontSize: 13,
  },
  loginLinkBold: {
    color: '#43e3eb',
    fontWeight: 'bold',
  }
});

export default SplashScreen;
