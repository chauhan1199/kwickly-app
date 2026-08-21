import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  Dimensions,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import KwicklyBrand, { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const { width: SW, height: SH } = Dimensions.get('window');

const CHIP_W = 68;
const CHIP_H = 76;
const IMG_SIZE = 38;
const GAP = 22;
const HERO_H = CHIP_H * 3 + GAP * 2;
const SIDE_W = CHIP_W + 16;

/* ── SVG ICONS ── */
const ShieldCheckIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={`${color}15`} />
    <Path d="M9 12l2 2 4-4" />
  </Svg>
);

const StopwatchIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" fill={`${color}15`} />
    <Path d="M12 9v4l2 2M12 2v2M10 2h4" />
  </Svg>
);

const BadgeIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill={`${color}15`} />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

const TagIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill={`${color}15`} />
    <Path d="M7 7h.01" />
  </Svg>
);

const BoxIcon = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill={color} />
    <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="#FFF" strokeWidth="1.5" />
  </Svg>
);

const UsersIcon = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill={color} stroke="none" />
    <Circle cx="9" cy="7" r="4" fill={color} stroke="none" />
    <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </Svg>
);

const StarIcon = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
);

const LocationPinMap = ({ color }) => (
  <Svg width="28" height="34" viewBox="0 0 24 32">
    <Path d="M12 0C6.48 0 2 4.48 2 10C2 17 12 32 12 32C12 32 22 17 22 10C22 4.48 17.52 0 12 0ZM12 14C9.79 14 8 12.21 8 10C8 7.79 9.79 6 12 6C14.21 6 16 7.79 16 10C16 12.21 14.21 14 12 14Z" fill={color} stroke="#FFFFFF" strokeWidth="1.5" />
  </Svg>
);

const ArrowRightIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);

/* ── DATA ── */
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
  { icon: ShieldCheckIcon, label: 'Trusted\nPros', color: '#6C47FF' },
  { icon: StopwatchIcon, label: 'On-Time\nService', color: '#0D9488' },
  { icon: BadgeIcon, label: 'Quality\nAssured', color: '#6C47FF' },
  { icon: TagIcon, label: 'Best\nPrices', color: '#6C47FF' },
];

const STATS = [
  { val: '50+', lbl: 'Categories', icon: BoxIcon, color: '#6C47FF' },
  { val: '1M+', lbl: 'Happy Users', icon: UsersIcon, color: '#6C47FF' },
  { val: '4.8★', lbl: 'Top Rated', icon: StarIcon, color: '#F59E0B' },
];

const WelcomeScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const headAnim = useRef(new Animated.Value(0)).current;
  const headSlide = useRef(new Animated.Value(15)).current;
  const pillAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  const cardScales = useRef([...Array(6)].map(() => new Animated.Value(0.85))).current;
  const phoneAnim = useRef(new Animated.Value(0)).current;
  const phoneScale = useRef(new Animated.Value(0.9)).current;
  const badgesAnim = useRef(new Animated.Value(0)).current;
  const badgesSlide = useRef(new Animated.Value(10)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(10)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(15)).current;
  const pinScale = useRef(new Animated.Value(1)).current;
  const pinOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);

    Animated.parallel([
      Animated.timing(logoAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(headAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(headSlide, { toValue: 0, duration: 300, easing, useNativeDriver: true }),
        ])
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(pillAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
      ]),
      ...cardAnims.map((anim, i) => Animated.sequence([
        Animated.delay(400 + i * 60),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(cardScales[i], { toValue: 1, duration: 300, easing, useNativeDriver: true }),
        ])
      ])),
      Animated.sequence([
        Animated.delay(450),
        Animated.parallel([
          Animated.timing(phoneAnim, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
          Animated.timing(phoneScale, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
        ])
      ]),
      Animated.sequence([
        Animated.delay(750),
        Animated.parallel([
          Animated.timing(badgesAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(badgesSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ])
      ]),
      Animated.sequence([
        Animated.delay(850),
        Animated.parallel([
          Animated.timing(statsAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(statsSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ])
      ]),
      Animated.sequence([
        Animated.delay(950),
        Animated.parallel([
          Animated.timing(ctaAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(ctaSlide, { toValue: 0, duration: 300, easing, useNativeDriver: true }),
        ])
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pinScale, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pinOpacity, { toValue: 0.7, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          ]),
          Animated.parallel([
            Animated.timing(pinScale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pinOpacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          ])
        ])
      ).start();
    });
  }, []);

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF2F7';

  const leftX = [16, 28, 16];
  const rightX = [16, 28, 16];
  const chipY = [0, CHIP_H + GAP, 2 * (CHIP_H + GAP)];

  // Safe area top calculation ensuring zero notch collision
  const safeTopPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;
  const safeBottomPadding = Math.max(insets.bottom, 16) + 8;

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#F8F9FD'}
        translucent={false}
      />

      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: safeTopPadding,
            paddingBottom: safeBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* TOP BRAND LOGO ROW */}
        <Animated.View style={[styles.logoRow, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
          <View style={[styles.logoBadge, { backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
            <KwicklyIcon size={34} />
          </View>
          <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
            Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
          </Text>
        </Animated.View>

        {/* HEADLINE */}
        <Animated.View style={[styles.headBlock, { opacity: headAnim, transform: [{ translateY: headSlide }] }]}>
          <Text style={[styles.hl, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            <Text style={{ color: '#6C47FF', fontWeight: '800' }}>Every</Text> Service.
          </Text>
          <Text style={[styles.hl, { color: isDarkMode ? '#F8FAFC' : '#0F172A', marginTop: 2 }]}>
            <Text style={{ color: '#6C47FF', fontWeight: '800' }}>Anytime.</Text> Near You.
          </Text>

          {/* TAGLINE PILL */}
          <Animated.View style={[styles.pill, { opacity: pillAnim, backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
            <Text style={[styles.pillTxt, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
              ⚡ Trusted Experts, Right Next Door.
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

          {/* Left Service Chips */}
          {LEFT_CHIPS.map((c, i) => (
            <Animated.View
              key={c.label}
              style={[
                styles.chipPos,
                {
                  top: chipY[i],
                  left: leftX[i],
                  opacity: cardAnims[i],
                  transform: [{ scale: cardScales[i] }],
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

          {/* Right Service Chips */}
          {RIGHT_CHIPS.map((c, i) => (
            <Animated.View
              key={c.label}
              style={[
                styles.chipPos,
                {
                  top: chipY[i],
                  right: rightX[i],
                  opacity: cardAnims[i + 3],
                  transform: [{ scale: cardScales[i + 3] }],
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
                <View style={[styles.featCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                  <Icon color={f.color} />
                </View>
                <Text style={[styles.featTxt, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>{f.label}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* STATS ROW */}
        <Animated.View style={[styles.statsRow, { opacity: statsAnim, transform: [{ translateY: statsSlide }] }]}>
          {STATS.map(s => {
            const Icon = s.icon;
            return (
              <View key={s.lbl} style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.statIcoBg, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF' }]}>
                  <Icon color={s.color} />
                </View>
                <Text style={[styles.statVal, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>{s.val}</Text>
                <Text style={[styles.statLbl, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{s.lbl}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* CTA BOTTOM ACTIONS */}
        <Animated.View style={[styles.cta, { opacity: ctaAnim, transform: [{ translateY: ctaSlide }] }]}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate('RoleSelection')}
            style={styles.ctaBtnWrapper}
          >
            <LinearGradient
              colors={['#7C3AED', '#6C47FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Text style={styles.btnTxt}>Create Account</Text>
              <View style={{ marginLeft: 8 }}>
                <ArrowRightIcon color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login', { role: 'CUSTOMER' })}
            style={styles.signInRow}
            activeOpacity={0.7}
          >
            <Text style={[styles.signInTxt, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Already have an account?{'  '}
              <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          <Text style={[styles.terms, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
            By continuing, you agree to Kwickly's{' '}
            <Text style={styles.termsLnk}>Terms</Text> &{' '}
            <Text style={styles.termsLnk}>Privacy Policy</Text>.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  /* Brand Logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  /* Headline */
  headBlock: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  hl: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  pill: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Hero zone */
  heroZone: {
    width: '100%',
    position: 'relative',
    marginVertical: 10,
  },
  heroCtr: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    width: SW - 160,
    height: HERO_H - 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  heroImg: {
    width: '90%',
    height: '90%',
  },
  pinOverlay: {
    position: 'absolute',
    top: '24%',
  },
  chipPos: {
    position: 'absolute',
    zIndex: 5,
  },
  chip: {
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  chipImg: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: 10,
    marginBottom: 4,
  },
  chipTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Feature badges */
  featRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  featItem: {
    flex: 1,
    alignItems: 'center',
  },
  featCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  featTxt: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIcoBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  /* CTA */
  cta: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  ctaBtnWrapper: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 25,
  },
  btn: {
    borderRadius: 25,
    paddingVertical: 15,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  signInRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 4,
  },
  signInTxt: {
    fontSize: 13,
    fontWeight: '600',
  },
  signInLink: {
    fontWeight: '800',
    color: '#6C47FF',
  },
  terms: {
    fontSize: 10.5,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 2,
  },
  termsLnk: {
    color: '#6C47FF',
    fontWeight: '600',
  },
});

export default WelcomeScreen;
