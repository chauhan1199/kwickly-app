import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Clock,
  Award,
  Tag,
  Package,
  Users,
  Star,
  MapPin,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const { width: SW, height: SH } = Dimensions.get('window');

// Adaptive hero height based on screen size
const HERO_H = Math.min(Math.max(SH * 0.26, 170), 220);
const CHIP_SIZE = Math.min(Math.max(SW * 0.18, 64), 74);

// Left & right service chips
const LEFT_CHIPS = [
  { label: 'Plumbing', img: require('../../assets/services/plumbing.jpeg') },
  { label: 'Car Repair', img: require('../../assets/services/car_repair_photo.png') },
  { label: 'Groceries', img: require('../../assets/services/groceries.png') },
];

const RIGHT_CHIPS = [
  { label: 'Electrician', img: require('../../assets/services/electrician.jpeg') },
  { label: 'Cleaning', img: require('../../assets/services/cleaning.jpeg') },
  { label: 'Delivery', img: require('../../assets/services/delivery.png') },
];

const FEATURES = [
  { icon: ShieldCheck, label: 'Trusted\nPros' },
  { icon: Clock, label: 'On-Time\nService' },
  { icon: Award, label: 'Quality\nAssured' },
  { icon: Tag, label: 'Best\nPrices' },
];

const STATS = [
  { icon: Package, value: '50+', label: 'Categories' },
  { icon: Users, value: '1M+', label: 'Happy Users' },
  { icon: Star, value: '4.8★', label: 'Top Rated', isStar: true },
];

const LocationPinMap = ({ color = '#6C47FF' }) => (
  <View style={styles.pinWrapper}>
    <MapPin size={26} color={color} fill={color} />
  </View>
);

const WelcomeScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Entrance animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const headAnim = useRef(new Animated.Value(0)).current;
  const headSlide = useRef(new Animated.Value(15)).current;
  const pillAnim = useRef(new Animated.Value(0)).current;

  const phoneAnim = useRef(new Animated.Value(0)).current;
  const phoneScale = useRef(new Animated.Value(0.75)).current;

  const cardAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const cardScales = useRef(Array.from({ length: 6 }, () => new Animated.Value(0.4))).current;

  const pinScale = useRef(new Animated.Value(1)).current;
  const pinOpacity = useRef(new Animated.Value(1)).current;

  const badgesAnim = useRef(new Animated.Value(0)).current;
  const badgesSlide = useRef(new Animated.Value(12)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(12)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(15)).current;

  // Background animated ambient floating orbs
  const bgOrb1 = useRef(new Animated.Value(0)).current;
  const bgOrb2 = useRef(new Animated.Value(0)).current;
  const bgOrb3 = useRef(new Animated.Value(0)).current;

  // Continuous micro-floating animations for service chips
  const chipFloatLeft = useRef(new Animated.Value(0)).current;
  const chipFloatRight = useRef(new Animated.Value(0)).current;

  // Subtle breathing scale on CTA button
  const ctaPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const easing = Easing.out(Easing.back(1.4));

    // Staggered Entrance Animations
    Animated.parallel([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(headAnim, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
          Animated.timing(headSlide, { toValue: 0, duration: 400, easing, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(pillAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(phoneAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(phoneScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        ]),
      ]),
      ...cardAnims.map((anim, idx) =>
        Animated.sequence([
          Animated.delay(300 + idx * 40),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(cardScales[idx], { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
          ]),
        ])
      ),
      Animated.sequence([
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(badgesAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(badgesSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(750),
        Animated.parallel([
          Animated.timing(statsAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(statsSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(850),
        Animated.parallel([
          Animated.timing(ctaAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(ctaSlide, { toValue: 0, duration: 300, easing, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      // Start Location Pin Pulse
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pinScale, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pinOpacity, { toValue: 0.7, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pinScale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pinOpacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ])
      ).start();

      // Start CTA Breathing Pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.02, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 0.99, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ).start();
    });

    // ─── AMBIENT BACKGROUND ANIMATION LOOPS ───
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrb1, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgOrb1, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrb2, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgOrb2, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrb3, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bgOrb3, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    // Floating chip micro-motions
    Animated.loop(
      Animated.sequence([
        Animated.timing(chipFloatLeft, { toValue: -4, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(chipFloatLeft, { toValue: 4, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(chipFloatRight, { toValue: 4, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(chipFloatRight, { toValue: -4, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF2F7';

  // Responsive chip positions
  const chipY = [HERO_H * 0.05, HERO_H * 0.38, HERO_H * 0.71];

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTopPadding = Math.max(insets.top, statusBarHeight) + 8;
  const safeBottomPadding = Math.max(insets.bottom, 12);

  // Background orb interpolations
  const orb1Y = bgOrb1.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const orb1X = bgOrb1.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const orb2Y = bgOrb2.interpolate({ inputRange: [0, 1], outputRange: [0, 35] });
  const orb2X = bgOrb2.interpolate({ inputRange: [0, 1], outputRange: [0, -25] });
  const orb3Scale = bgOrb3.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.2] });

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#F8F9FD'}
        translucent={false}
      />

      {/* Base Gradient Layer */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── AMBIENT BACKGROUND ANIMATED GLOW ORBS ─── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgOrbTopLeft,
          {
            transform: [
              { translateY: orb1Y },
              { translateX: orb1X },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#8B5CF6', '#6C47FF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgOrbBottomRight,
          {
            transform: [
              { translateY: orb2Y },
              { translateX: orb2X },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#3B82F6', '#6C47FF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgOrbCenter,
          {
            transform: [{ scale: orb3Scale }],
          },
        ]}
      />

      {/* Main Viewport Container — Fits screen perfectly */}
      <View
        style={[
          styles.mainContainer,
          {
            paddingTop: safeTopPadding,
            paddingBottom: safeBottomPadding,
          },
        ]}
      >
        {/* TOP BRAND LOGO ROW */}
        <Animated.View style={[styles.logoRow, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
          <KwicklyIcon size={38} />
          <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
            Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
          </Text>
        </Animated.View>

        {/* HEADLINE */}
        <Animated.View style={[styles.headBlock, { opacity: headAnim, transform: [{ translateY: headSlide }] }]}>
          <Text style={[styles.hl, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            <Text style={{ color: '#6C47FF', fontWeight: '900' }}>Every Local Services</Text> & Products
          </Text>
          <Text style={[styles.hlSub, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
            Anytime. Near You.
          </Text>

          {/* TAGLINE PILL */}
          <Animated.View style={[styles.pill, { opacity: pillAnim, backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
            <Text style={[styles.pillTxt, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
              ⚡ Trusted Local Experts & Shops, Right Next Door.
            </Text>
          </Animated.View>
        </Animated.View>

        {/* HERO ZONE */}
        <View style={[styles.heroZone, { height: HERO_H }]}>
          {/* Center illustration container */}
          <Animated.View style={[styles.heroCtr, { opacity: phoneAnim, transform: [{ scale: phoneScale }] }]}>
            <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#111726' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
              <Image
                source={require('../../assets/images/splash_hero.png')}
                style={styles.heroImg}
                resizeMode="contain"
              />
              <Animated.View
                style={[
                  styles.pinOverlay,
                  {
                    transform: [{ scale: pinScale }],
                    opacity: pinOpacity,
                  },
                ]}
              >
                <LocationPinMap color="#6C47FF" />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Left Service Chips with Gentle Floating Motion */}
          {LEFT_CHIPS.map((c, i) => (
            <Animated.View
              key={c.label}
              style={[
                styles.chipPos,
                {
                  top: chipY[i],
                  left: 4,
                  opacity: cardAnims[i],
                  transform: [
                    { scale: cardScales[i] },
                    { translateY: chipFloatLeft },
                  ],
                },
              ]}
            >
              <View style={[styles.chip, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Image source={c.img} style={styles.chipImg} resizeMode="cover" />
                <Text style={[styles.chipTxt, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]} numberOfLines={1}>
                  {c.label}
                </Text>
              </View>
            </Animated.View>
          ))}

          {/* Right Service Chips with Gentle Floating Motion */}
          {RIGHT_CHIPS.map((c, i) => (
            <Animated.View
              key={c.label}
              style={[
                styles.chipPos,
                {
                  top: chipY[i],
                  right: 4,
                  opacity: cardAnims[i + 3],
                  transform: [
                    { scale: cardScales[i + 3] },
                    { translateY: chipFloatRight },
                  ],
                },
              ]}
            >
              <View style={[styles.chip, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Image source={c.img} style={styles.chipImg} resizeMode="cover" />
                <Text style={[styles.chipTxt, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]} numberOfLines={1}>
                  {c.label}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* FEATURES ROW */}
        <Animated.View style={[styles.featRow, { opacity: badgesAnim, transform: [{ translateY: badgesSlide }] }]}>
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <View key={f.label} style={styles.featItem}>
                <View style={[styles.featCircle, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF' }]}>
                  <Icon size={16} color="#6C47FF" />
                </View>
                <Text style={[styles.featLbl, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {f.label}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* STATS ROW */}
        <Animated.View style={[styles.statsRow, { opacity: statsAnim, transform: [{ translateY: statsSlide }] }]}>
          {STATS.map(s => {
            const Icon = s.icon;
            return (
              <View
                key={s.label}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={[styles.statIconBox, { backgroundColor: s.isStar ? '#FEF3C7' : (isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF') }]}>
                  <Icon size={15} color={s.isStar ? '#F59E0B' : '#6C47FF'} />
                </View>
                <Text style={[styles.statVal, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                  {s.value}
                </Text>
                <Text style={[styles.statLbl, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* CTA ACTION BUTTON WITH SUBTLE BREATHING PULSE */}
        <Animated.View 
          style={[
            styles.ctaBlock, 
            { 
              opacity: ctaAnim, 
              transform: [
                { translateY: ctaSlide },
                { scale: ctaPulse },
              ] 
            }
          ]}
        >
          <TouchableOpacity
            style={styles.btnShadow}
            onPress={() => navigation.navigate('RoleSelection')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#7C3AED', '#6C47FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnGradient}
            >
              <Text style={styles.btnTxt}>Create Account →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={[styles.signInPrompt, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Already have an account?{' '}
              <Text style={styles.signInHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bgOrbTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.15,
    overflow: 'hidden',
  },
  bgOrbBottomRight: {
    position: 'absolute',
    bottom: SH * 0.12,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.13,
    overflow: 'hidden',
  },
  bgOrbCenter: {
    position: 'absolute',
    top: SH * 0.28,
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7C3AED',
    opacity: 0.08,
  },
  mainContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
  },

  /* Brand Logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  /* Headline */
  headBlock: {
    alignItems: 'center',
    marginTop: 2,
  },
  hl: {
    fontSize: Math.min(SW * 0.056, 23),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  hlSub: {
    fontSize: Math.min(SW * 0.048, 19),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  pill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillTxt: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Hero Zone */
  heroZone: {
    width: SW - 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  heroCtr: {
    width: HERO_H * 0.72,
    height: HERO_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroCard: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroImg: {
    width: '90%',
    height: '90%',
  },
  pinOverlay: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
  },
  pinWrapper: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  /* Service Chips */
  chipPos: {
    position: 'absolute',
    zIndex: 4,
  },
  chip: {
    width: CHIP_SIZE,
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chipImg: {
    width: 32,
    height: 32,
    borderRadius: 9,
    marginBottom: 3,
  },
  chipTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Features */
  featRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 4,
  },
  featItem: {
    alignItems: 'center',
    gap: 3,
  },
  featCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  /* CTA Block */
  ctaBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 16,
  },
  btnGradient: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  signInBtn: {
    paddingVertical: 4,
  },
  signInPrompt: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  signInHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
});

export default WelcomeScreen;
