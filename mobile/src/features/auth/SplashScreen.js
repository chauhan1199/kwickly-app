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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   LAYOUT
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CHIP_W = 66;
const CHIP_H = 78;
const IMG_SIZE = 42;
const GAP = 28; // Highly precise gap to allow perfect Map Pin placement
const HERO_H = CHIP_H * 3 + GAP * 2;
const SIDE_W = CHIP_W + 16;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SVG ICONS
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
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

const CityscapeBackground = () => (
  <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', bottom: 0, opacity: 0.15, left: 0, right: 0 }}>
    <Path d="M0,200 L0,150 L30,150 L30,120 L70,120 L70,140 L100,140 L100,90 L130,90 L130,110 L160,110 L160,70 L200,70 L200,100 L240,100 L240,60 L280,60 L280,120 L320,120 L320,80 L360,80 L360,140 L400,140 L400,200 Z" fill="#6C4CE0" />
    <Circle cx="50" cy="180" r="10" fill="#6C4CE0" />
    <Circle cx="50" cy="170" r="8" fill="#6C4CE0" />
    <Circle cx="350" cy="175" r="12" fill="#6C4CE0" />
    <Circle cx="340" cy="165" r="8" fill="#6C4CE0" />
    <Circle cx="220" cy="185" r="9" fill="#6C4CE0" />
  </Svg>
);

const ArrowRightIcon = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   DATA
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const LEFT_CHIPS = [
  { label: 'Plumbing', img: require('../../assets/services/plumbing.jpeg') },
  { label: 'Car Repair', img: require('../../assets/services/car_repair_photo.png') },
  { label: 'Groceries', img: require('../../assets/services/groceries.png') },
];
const RIGHT_CHIPS = [
  { label: 'Electrician', img: require('../../assets/services/electrician.jpeg') },
  { label: 'Home Cleaning', img: require('../../assets/services/cleaning.jpeg') },
  { label: 'Delivery', img: require('../../assets/services/delivery.png') },
];

const FEATURES = [
  { icon: ShieldCheckIcon, label: 'Trusted\nProfessionals', color: '#8B5CF6' },
  { icon: StopwatchIcon, label: 'On-Time\nServices', color: '#0D9488' }, // Teal/Green accent
  { icon: BadgeIcon, label: 'Quality\nAssured', color: '#8B5CF6' },
  { icon: TagIcon, label: 'Best\nPrices', color: '#8B5CF6' },
];

const STATS = [
  { val: '50+', lbl: 'Categories', icon: BoxIcon, color: '#8B5CF6' },
  { val: '1M+', lbl: 'Users', icon: UsersIcon, color: '#8B5CF6' },
  { val: '4.8', lbl: 'Rating', icon: StarIcon, color: '#8B5CF6' },
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   COMPONENT
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const SplashScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();

  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  
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
      // 1. Logo (0ms)
      Animated.timing(logoAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
      
      // 2. Headline (200ms)
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(headAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(headSlide, { toValue: 0, duration: 300, easing, useNativeDriver: true }),
        ])
      ]),

      // 3. Pill (400ms)
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(pillAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
      ]),

      // 4. Cards (500ms, staggered 80ms)
      ...cardAnims.map((anim, i) => Animated.sequence([
        Animated.delay(500 + i * 80),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(cardScales[i], { toValue: 1, duration: 300, easing, useNativeDriver: true }),
        ])
      ])),

      // 5. Phone (550ms)
      Animated.sequence([
        Animated.delay(550),
        Animated.parallel([
          Animated.timing(phoneAnim, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
          Animated.timing(phoneScale, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
        ])
      ]),

      // 6. Badges (950ms)
      Animated.sequence([
        Animated.delay(950),
        Animated.parallel([
          Animated.timing(badgesAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(badgesSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ])
      ]),

      // 7. Stats (1050ms)
      Animated.sequence([
        Animated.delay(1050),
        Animated.parallel([
          Animated.timing(statsAnim, { toValue: 1, duration: 250, easing, useNativeDriver: true }),
          Animated.timing(statsSlide, { toValue: 0, duration: 250, easing, useNativeDriver: true }),
        ])
      ]),

      // 8. CTA (1150ms)
      Animated.sequence([
        Animated.delay(1150),
        Animated.parallel([
          Animated.timing(ctaAnim, { toValue: 1, duration: 300, easing, useNativeDriver: true }),
          Animated.timing(ctaSlide, { toValue: 0, duration: 300, easing, useNativeDriver: true }),
        ])
      ]),
    ]).start(() => {
      // Pin Pulse Loop
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardBg = isDarkMode ? theme.colors.card : '#FFFFFF';

  // Chip positions
  const leftX = [20, 36, 20];
  const rightX = [20, 36, 20];
  const chipY = [0, CHIP_H + GAP, 2 * (CHIP_H + GAP)];

  // ==========================================
  // PRECISE MAP PIN AND DOTTED LINE MATH
  // ==========================================
  
  const C_Y = [
    chipY[0] + CHIP_H / 2,
    chipY[1] + CHIP_H / 2,
    chipY[2] + CHIP_H / 2,
  ];

  // Left side points
  const L_edge = [
    leftX[0] + CHIP_W,
    leftX[1] + CHIP_W,
    leftX[2] + CHIP_W,
  ];
  
  // Right side points
  return (
    <View style={[st.root, { backgroundColor: isDarkMode ? theme.colors.background : '#F7F5FF' }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isDarkMode ? [theme.colors.surface, theme.colors.background] : ['#FFFFFF', '#FFFFFF', '#FAFAFF', '#EDE6FF', '#E3DAFF', '#F9F8FF']}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.1, 0.3, 0.6, 0.85, 1]}
      />

      <View style={st.container}>

        {/* LOGO */}
        <Animated.View style={[st.logoRow, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
          <Image source={require('../../assets/images/logo.jpeg')} style={st.logoImg} resizeMode="contain" />
          <Text style={[st.wordmark, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>
            Kwick<Text style={{ color: '#6C3FF5' }}>ly</Text>
          </Text>
        </Animated.View>

        {/* HEADLINE */}
        <Animated.View style={[st.headBlock, { opacity: headAnim, transform: [{ translateY: headSlide }] }]}>
          <Text style={[st.hl, { color: isDarkMode ? '#F0EBFF' : '#1F2937' }]}>
            <Text style={st.hlPurple}>Every</Text> Service.
          </Text>
          <Text style={[st.hl, { color: isDarkMode ? '#F0EBFF' : '#1F2937', marginTop: 4 }]}>
            <Text style={st.hlPurple}>Anytime.</Text> Near You.
          </Text>
          
          {/* TAGLINE PILL */}
          <Animated.View style={[st.pill, { opacity: pillAnim, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#FFFFFF' }]}>
            <Text style={[st.pillTxt, { color: isDarkMode ? '#C4B5FD' : '#4B5563' }]}>
              Trusted Experts, Right Next Door.
            </Text>
          </Animated.View>
        </Animated.View>

        {/* HERO ZONE */}
        <View style={[st.heroZone, { height: HERO_H }]}>

          {/* Cityscape Background */}
          <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
            <CityscapeBackground />
          </View>

          {/* Center illustration */}
          <Animated.View style={[st.heroCtr, { opacity: phoneAnim, transform: [{ scale: phoneScale }] }]}>
            <Image
              source={require('../../assets/images/splash_hero.png')}
              style={[st.heroImg, { width: SW - SIDE_W * 2 + 10, height: HERO_H + 40 }]}
              resizeMode="contain"
            />
            {/* Animated Pin Overlay mapped over the baked image pin */}
            <Animated.View style={{
              position: 'absolute',
              top: '25%', // Approx vertical placement of the original pin in the map
              transform: [{ scale: pinScale }],
              opacity: pinOpacity,
            }}>
              <LocationPinMap color="#6C4CE0" />
            </Animated.View>
          </Animated.View>

          {/* Left Chips */}
          {LEFT_CHIPS.map((c, i) => (
            <React.Fragment key={c.label}>
              <Animated.View style={[st.chipPos, { top: chipY[i], left: leftX[i], opacity: cardAnims[i], transform: [{ scale: cardScales[i] }] }]}>
                <View style={[st.chip, { backgroundColor: cardBg }]}>
                  <Image source={c.img} style={st.chipImg} resizeMode="cover" />
                  <Text style={[st.chipTxt, { color: isDarkMode ? '#E9D5FF' : '#1F2937' }]}>{c.label}</Text>
                </View>
              </Animated.View>
            </React.Fragment>
          ))}

          {/* Right Chips */}
          {RIGHT_CHIPS.map((c, i) => (
            <React.Fragment key={c.label}>
              <Animated.View style={[st.chipPos, { top: chipY[i], right: rightX[i], opacity: cardAnims[i + 3], transform: [{ scale: cardScales[i + 3] }] }]}>
                <View style={[st.chip, { backgroundColor: cardBg }]}>
                  <Image source={c.img} style={st.chipImg} resizeMode="cover" />
                  <Text style={[st.chipTxt, { color: isDarkMode ? '#E9D5FF' : '#1F2937' }]}>{c.label}</Text>
                </View>
              </Animated.View>
            </React.Fragment>
          ))}
        </View>

        {/* FEATURES ROW */}
        <Animated.View style={[st.featRow, { opacity: badgesAnim, transform: [{ translateY: badgesSlide }] }]}>
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <View key={f.label} style={st.featItem}>
                <View style={[st.featCircle, { backgroundColor: isDarkMode ? '#2D1F6E' : '#FFFFFF' }]}>
                  <Icon color={f.color} />
                </View>
                <Text style={[st.featTxt, { color: isDarkMode ? '#C4B5FD' : '#374151' }]}>{f.label}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* STATS ROW */}
        <Animated.View style={[st.statsRow, { opacity: statsAnim, transform: [{ translateY: statsSlide }] }]}>
          {STATS.map(s => {
            const Icon = s.icon;
            return (
              <View key={s.lbl} style={[st.statCard, { backgroundColor: cardBg }]}>
                <View style={[st.statIcoBg, { backgroundColor: isDarkMode ? '#2D1F6E' : '#F7F5FF' }]}>
                  <Icon color={s.color} />
                </View>
                <Text style={[st.statVal, { color: s.color }]}>{s.val}</Text>
                <Text style={[st.statLbl, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>{s.lbl}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[st.cta, { opacity: ctaAnim, transform: [{ translateY: ctaSlide }] }]}>
          <TouchableOpacity activeOpacity={0.87} onPress={() => navigation.navigate('RoleSelection')} style={{ width: '100%' }}>
            <LinearGradient colors={['#5C3EE0', '#4A1D96']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.btn}>
              <Text style={st.btnTxt}>Create Account</Text>
              <View style={{ marginLeft: 8 }}>
                <ArrowRightIcon color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Login', { role: 'CUSTOMER' })} style={st.signInRow}>
            <Text style={[st.signInTxt, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Already have an account?{'  '}
              <Text style={st.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
          <Text style={[st.terms, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
            By joining, you agree to our <Text style={st.termsLnk}>Terms of Service</Text> and <Text style={st.termsLnk}>Privacy Policy</Text>.
          </Text>
        </Animated.View>

      </View>
    </View>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   STYLESHEET
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const st = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: SH > 800 ? 24 : 14,
    justifyContent: 'space-between',
  },

  /* Logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 64,
    height: 64,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: -4, // Visually pull text up to align with the green stopwatch circle center
  },

  /* Headline */
  headBlock: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  hl: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  hlPurple: {
    color: '#6C4CE0',
    fontWeight: '700',
  },
  pill: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    shadowColor: '#6C4CE0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: '#374151',
  },

  /* Hero zone */
  heroZone: {
    width: SW,
    position: 'relative',
    marginTop: 6,
  },
  heroCtr: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -20,
    bottom: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPos: {
    position: 'absolute',
    zIndex: 2, // Keep chips above lines
  },
  chip: {
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#6C4CE0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  chipImg: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: 12,
    marginBottom: 6,
  },
  chipTxt: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Feature badges */
  featRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 18,
  },
  featItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  featCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#6C4CE0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  featTxt: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#6C4CE0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  statIcoBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 0,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* CTA */
  cta: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 18,
  },
  btn: {
    borderRadius: 30,
    paddingVertical: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C4CE0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnTxt: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  signInRow: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  signInTxt: {
    fontSize: 13,
    fontWeight: '500',
  },
  signInLink: {
    fontWeight: '700',
    color: '#7C3AED',
  },
  terms: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 16,
  },
  termsLnk: {
    color: '#7C3AED',
    fontWeight: '600',
  },
});

export default SplashScreen;
