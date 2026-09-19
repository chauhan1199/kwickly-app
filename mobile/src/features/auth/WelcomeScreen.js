import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  StatusBar,
  Image,
  Platform,
  ScrollView,
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
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { getSafeBottomInset, getSafeTopInset } from '../../utils/safeInsets';

const LEFT_CHIPS = [
  { key: 'plumbing', label: 'Plumbing', icon: require('../../assets/images/icon_plumbing.png') },
  { key: 'car', label: 'Car Repair', icon: require('../../assets/images/icon_car.png') },
  { key: 'groceries', label: 'Groceries', icon: require('../../assets/images/icon_groceries.png') },
];

const RIGHT_CHIPS = [
  { key: 'electrician', label: 'Electrician', icon: require('../../assets/images/icon_electrician.png') },
  { key: 'cleaning', label: 'Cleaning', icon: require('../../assets/images/icon_cleaning.png') },
  { key: 'delivery', label: 'Delivery', icon: require('../../assets/images/icon_delivery.png') },
];

const FEATURES = [
  { icon: ShieldCheck, label: 'Trusted\nPros', color: '#10B981', bg: '#ECFDF5' },
  { icon: Clock, label: 'On-Time\nService', color: '#6C47FF', bg: '#F5F3FF' },
  { icon: Award, label: 'Quality\nAssured', color: '#3B82F6', bg: '#EFF6FF' },
  { icon: Tag, label: 'Best\nPrices', color: '#EC4899', bg: '#FDF2F8' },
];

const STATS = [
  { icon: Package, value: '40+', label: 'Categories', bg: '#F5F3FF', border: '#DDD6FE', text: '#6C47FF' },
  { icon: Users, value: '25K+', label: 'Happy Users', bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },
  { icon: Star, value: '4.7★', label: 'Top Rated', bg: '#FEF3C7', border: '#FDE68A', text: '#D97706' },
];

const WelcomeScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const contentWidth = Math.min(windowWidth, 480);
  // Responsive hero height: smaller on small screens to fit all content
  const isSmallScreen = windowHeight < 700;
  const heroH = isSmallScreen
    ? Math.min(Math.max(windowHeight * 0.19, 145), 170)
    : Math.min(Math.max(windowHeight * 0.22, 165), 195);
  const chipH = (heroH - 10) / 3;
  const chipW = Math.min(Math.max(contentWidth * 0.19, 64), 76);

  const safeTopPadding = getSafeTopInset(insets, 14);
  const safeBottomInset = getSafeBottomInset(insets, 8);

  const footerAspect = isDarkMode ? (448 / 1376) : (99 / 576);
  // Cap footer height on small screens so it doesn't hide the Sign In button
  const rawFooterHeight = Math.round(Math.min(windowWidth, 600) * footerAspect);
  const footerHeight = isSmallScreen ? Math.min(rawFooterHeight, 60) : rawFooterHeight;

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Base Ambient Gradient */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Corner Orbs */}
      <View pointerEvents="none" style={styles.bgOrbTopLeft}>
        <LinearGradient colors={['#8B5CF6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>
      <View pointerEvents="none" style={styles.bgOrbBottomRight}>
        <LinearGradient colors={['#3B82F6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>

      {/* Responsive Viewport ScrollView Container */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.mainContent,
          {
            paddingTop: safeTopPadding,
            paddingBottom: footerHeight + safeBottomInset + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* TOP BRAND LOGO ROW */}
        <View style={styles.logoRow}>
          <KwicklyIcon size={48} />
          <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
            Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
          </Text>
        </View>

        {/* HEADLINE (Reference 3) */}
        <View style={styles.headBlock}>
          <Text style={[styles.hl, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            Local Services & Products
          </Text>
          <Text style={[styles.hlSub, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            <Text style={{ color: '#6C47FF' }}>Anytime.</Text> Near You.
          </Text>
          <Text style={[styles.hlDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Home services, daily needs and more — all in one place.
          </Text>
        </View>

        {/* 3-COLUMN HERO SECTION (Matches Reference 3) */}
        <View style={[styles.heroRow, { height: heroH, width: '100%' }]}>
          {/* Left Column: 3 Chips */}
          <View style={styles.chipsCol}>
            {LEFT_CHIPS.map((chip) => (
              <View
                key={chip.key}
                style={[
                  styles.chipCard,
                  {
                    height: chipH,
                    width: chipW,
                    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Image
                  source={chip.icon}
                  style={styles.chipIconImg}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isDarkMode ? '#F1F5F9' : '#0F172A' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Center Column: 3D Delivery Rider Card */}
          <View style={[styles.heroCenterCard, { backgroundColor: isDarkMode ? '#111726' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
            <Image
              source={
                isDarkMode
                  ? require('../../assets/images/hero_welcome_dark.png')
                  : require('../../assets/images/hero_welcome.png')
              }
              style={styles.heroCenterImg}
              resizeMode="contain"
            />
          </View>

          {/* Right Column: 3 Chips */}
          <View style={styles.chipsCol}>
            {RIGHT_CHIPS.map((chip) => (
              <View
                key={chip.key}
                style={[
                  styles.chipCard,
                  {
                    height: chipH,
                    width: chipW,
                    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Image
                  source={chip.icon}
                  style={styles.chipIconImg}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isDarkMode ? '#F1F5F9' : '#0F172A' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 4 FEATURES ROW */}
        <View style={styles.featRow}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <View key={f.label} style={styles.featItem}>
                <View
                  style={[
                    styles.featCircle,
                    {
                      backgroundColor: isDarkMode ? `${f.color}22` : f.bg,
                      borderColor: isDarkMode ? `${f.color}44` : '#E2E8F0',
                    },
                  ]}
                >
                  <Icon size={14} color={f.color} />
                </View>
                <Text style={[styles.featLbl, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
                  {f.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 3 STATS SUMMARY CARDS */}
        <View style={styles.statsRow}>
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <View
                key={s.label}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: isDarkMode ? '#131B2E' : s.bg,
                    borderColor: isDarkMode ? '#1E293B' : s.border,
                  },
                ]}
              >
                <Icon size={16} color={s.text} style={{ marginBottom: 2 }} />
                <Text style={[styles.statVal, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                  {s.value}
                </Text>
                <Text style={[styles.statLbl, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* PRIMARY CTA & SIGN IN LINK */}
        <View style={styles.ctaBlock}>
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
        </View>
      </ScrollView>

      {/* Bottom Road Landscape Illustration pinned flush to bottom edge */}
      <View 
        style={[
          styles.footerWrap, 
          { 
            paddingBottom: safeBottomInset,
            backgroundColor: 'transparent',
          }
        ]} 
        pointerEvents="none"
      >
        <Image
          source={
            isDarkMode
              ? require('../../assets/images/footer_landscape_dark.png')
              : require('../../assets/images/footer_landscape.png')
          }
          style={[styles.footerLandscapeImg, { height: footerHeight }]}
          resizeMode={isDarkMode ? 'cover' : 'contain'}
        />
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
    bottom: 90,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.13,
    overflow: 'hidden',
  },
  mainContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 0,
    marginBottom: 2,
  },
  wordmark: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headBlock: {
    alignItems: 'center',
    marginBottom: 2,
  },
  hl: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  hlSub: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 1,
    letterSpacing: -0.3,
  },
  hlDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 2,
  },
  chipsCol: {
    width: 76,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipCard: {
    width: 76,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipIconImg: {
    width: '100%',
    height: 26,
    marginBottom: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  heroCenterCard: {
    flex: 1,
    height: '100%',
    marginHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  heroCenterImg: {
    width: '100%',
    height: '100%',
  },
  featRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  featItem: {
    alignItems: 'center',
    gap: 2,
  },
  featCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  featLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
    marginVertical: 2,
  },
  statCard: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statVal: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  ctaBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
  btnGradient: {
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  signInBtn: {
    marginTop: 6,
    paddingVertical: 3,
  },
  signInPrompt: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  signInHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  footerWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'center',
  },
  footerLandscapeImg: {
    width: '100%',
    maxWidth: 600,
  },
});

export default WelcomeScreen;
