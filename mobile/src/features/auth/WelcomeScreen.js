import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
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

const { width: SW, height: SH } = Dimensions.get('window');

// Adaptive sizing for 3-column hero zone (Reference 3)
const HERO_H = Math.min(Math.max(SH * 0.29, 210), 250);
const CHIP_W = Math.min(Math.max(SW * 0.20, 72), 85);
const CHIP_H = (HERO_H - 14) / 3;

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

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTopPadding = Math.max(insets.top, statusBarHeight) + 8;
  const safeBottomPadding = Math.max(insets.bottom, 10);

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

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: safeTopPadding,
            paddingBottom: safeBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* TOP BRAND LOGO ROW */}
        <View style={styles.logoRow}>
          <KwicklyIcon size={36} />
          <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
            KWICKLY
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
        <View style={[styles.heroRow, { height: HERO_H }]}>
          {/* Left Column: 3 Chips */}
          <View style={styles.chipsCol}>
            <Image
              source={require('../../assets/images/chip_plumbing.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/chip_car.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/chip_groceries.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
          </View>

          {/* Center Column: 3D Delivery Rider Card */}
          <View style={[styles.heroCenterCard, { backgroundColor: isDarkMode ? '#111726' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
            <Image
              source={require('../../assets/images/hero_welcome.png')}
              style={styles.heroCenterImg}
              resizeMode="contain"
            />
          </View>

          {/* Right Column: 3 Chips */}
          <View style={styles.chipsCol}>
            <Image
              source={require('../../assets/images/chip_electrician.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/chip_cleaning.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/chip_delivery.png')}
              style={[styles.chipImg, { height: CHIP_H }]}
              resizeMode="contain"
            />
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
                  <Icon size={16} color={f.color} />
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
                <Icon size={18} color={s.text} style={{ marginBottom: 4 }} />
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

        {/* Bottom Road Landscape Illustration */}
        <Image
          source={require('../../assets/images/footer_landscape.png')}
          style={styles.footerLandscapeImg}
          resizeMode="cover"
          pointerEvents="none"
        />
      </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  hl: {
    fontSize: Math.min(SW * 0.058, 23),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  hlSub: {
    fontSize: Math.min(SW * 0.054, 21),
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  hlDesc: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 6,
  },
  chipsCol: {
    width: CHIP_W,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipImg: {
    width: CHIP_W,
    borderRadius: 12,
  },
  heroCenterCard: {
    flex: 1,
    height: '100%',
    marginHorizontal: 8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  heroCenterImg: {
    width: '100%',
    height: '100%',
  },
  featRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  featItem: {
    alignItems: 'center',
    gap: 3,
  },
  featCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  featLbl: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLbl: {
    fontSize: 10,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  btnGradient: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  signInBtn: {
    marginTop: 10,
    paddingVertical: 4,
  },
  signInPrompt: {
    fontSize: 13,
    fontWeight: '600',
  },
  signInHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  footerLandscapeImg: {
    width: SW,
    height: 115,
    marginTop: 6,
  },
});

export default WelcomeScreen;
