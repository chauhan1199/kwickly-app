import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const LiveTrackingScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { worker } = route.params || {};

  // Mock a worker if not passed
  const w = worker || {
    name: 'Ramesh Kumar', rating: 4.8, jobs: 312, eta: 25, dist: '1.2 km'
  };

  const otp = '4 7 2 9';

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Live Tracking</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>{w.name} is on the way</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Mock Map Area */}
        <View style={styles.mapArea}>
          <View style={styles.mapRoute} />
          <View style={[styles.mapPin, { left: '20%', bottom: '30%', backgroundColor: theme.colors.primary }]} />
          <View style={[styles.mapPin, { right: '20%', top: '30%', backgroundColor: '#ef4444' }]} />
          <View style={styles.mapLabel}>
            <Text style={styles.mapLabelText}>⏱ ETA {w.eta} min</Text>
          </View>
        </View>

        {/* Worker Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>{w.name ? w.name[0] : 'W'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.workerName}>{w.name || 'Worker'}</Text>
              <Text style={styles.workerMuted}>★ {typeof w.rating === 'object' ? (w.rating?.average || 0) : (w.rating || 4.5)} · {w.dist}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{fontSize: 16}}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{fontSize: 16}}>💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Arrival OTP */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arrival OTP</Text>
          <Text style={styles.cardSub}>Share with worker when they arrive</Text>
          <View style={styles.otpBox}>
            <Text style={styles.otpText}>{otp}</Text>
          </View>
        </View>

        {/* Job Progress Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job Progress</Text>
          <View style={styles.timeline}>
            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotDone]} />
              <View style={styles.tlLineDone} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitle}>Job Posted</Text>
                <Text style={styles.tlSub}>Just now</Text>
              </View>
            </View>

            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotDone]} />
              <View style={styles.tlLineDone} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitle}>Pro Accepted</Text>
                <Text style={styles.tlSub}>{w.name}</Text>
              </View>
            </View>

            <View style={styles.tlItem}>
              <View style={[styles.tlDot, styles.tlDotActive]} />
              <View style={styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={[styles.tlTitle, {color: theme.colors.primary}]}>On the Way</Text>
                <Text style={styles.tlSub}>ETA {w.eta} min</Text>
              </View>
            </View>

            <View style={styles.tlItem}>
              <View style={styles.tlDot} />
              <View style={styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitleMuted}>Arrived (OTP)</Text>
              </View>
            </View>

            <View style={styles.tlItem}>
              <View style={styles.tlDot} />
              <View style={styles.tlLine} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitleMuted}>Work in Progress</Text>
              </View>
            </View>

            <View style={styles.tlItem}>
              <View style={styles.tlDot} />
              <View style={styles.tlContent}>
                <Text style={styles.tlTitleMuted}>Payment & Rating</Text>
              </View>
            </View>

          </View>
        </View>

        <TouchableOpacity 
          style={styles.simulateBtn}
          onPress={() => navigation.navigate('WorkCompleted', { worker: w })}
        >
          <Text style={styles.simulateBtnText}>⚡ Simulate: Work Completed</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  mapArea: {
    height: 200,
    backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  mapRoute: {
    position: 'absolute',
    left: '20%',
    top: '30%',
    width: '60%',
    height: '40%',
    borderBottomWidth: 2,
    borderColor: theme.colors.primary,
    transform: [{ rotate: '-15deg' }],
  },
  mapPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14, 154, 167, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  workerName: {
    fontWeight: '800',
    fontSize: 14,
    color: theme.colors.text,
  },
  workerMuted: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  otpBox: {
    marginTop: 12,
    backgroundColor: 'rgba(14, 154, 167, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 12,
    color: theme.colors.primary,
  },
  timeline: {
    marginTop: 14,
  },
  tlItem: {
    flexDirection: 'row',
    marginBottom: 0,
    position: 'relative',
    paddingBottom: 20,
  },
  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border,
    marginTop: 4,
    zIndex: 2,
  },
  tlDotDone: {
    backgroundColor: theme.colors.primary,
  },
  tlDotActive: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(14, 154, 167, 0.3)',
  },
  tlLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: theme.colors.border,
    zIndex: 1,
  },
  tlLineDone: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: theme.colors.primary,
    zIndex: 1,
  },
  tlContent: {
    marginLeft: 16,
    flex: 1,
  },
  tlTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tlTitleMuted: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  tlSub: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  simulateBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  simulateBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default LiveTrackingScreen;
