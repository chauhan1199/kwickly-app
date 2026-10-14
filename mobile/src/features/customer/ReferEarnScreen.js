import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Share,
  Linking,
  Alert
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import { useTheme } from '../../context/ThemeContext';

const ReferEarnScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const messageToShare = `Hey! Check out Kwickly! It's the best app for booking local services. Let's make life easier! 🚀`;

  const handleShareWhatsApp = async () => {
    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(messageToShare)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to native share if WhatsApp is not installed
        await Share.share({
          message: messageToShare,
        });
      }
    } catch (error) {
      Share.share({ message: messageToShare }).catch(() => {});
    }
  };

  const handleShareNative = async () => {
    try {
      await Share.share({
        message: messageToShare,
      });
    } catch (error) {
      Alert.alert('Share', 'Could not share at this time');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar 
          title="Share App"
          showBack={true}
          transparent={true} 
          showLogo={false} 
          onBackPress={() => navigation.goBack()}
        />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <View style={styles.heroBox}>
          <Text style={{fontSize: 70, marginBottom: 20}}>📢</Text>
          <Text style={styles.heroTitle}>Share Kwickly</Text>
          <Text style={styles.heroSub}>Share the Kwickly app with your friends and family to make booking local services easier than ever.</Text>
        </View>

        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#25D366', borderColor: '#25D366', marginBottom: 16 }]} onPress={handleShareWhatsApp}>
          <Text style={[styles.shareBtnText, { color: '#fff' }]}>Share via WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.primary }]} onPress={handleShareNative}>
          <Text style={[styles.shareBtnText, { color: theme.colors.primary }]}>More Sharing Options</Text>
        </TouchableOpacity>

        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>Why Share Kwickly?</Text>
          
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>✨</Text></View>
            <Text style={styles.stepText}>Easy access to local services</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>🛡️</Text></View>
            <Text style={styles.stepText}>Verified professionals at your doorstep</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>⚡</Text></View>
            <Text style={styles.stepText}>Fast and reliable bookings</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20 },
  heroBox: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  heroSub: { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  shareBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 40
  },
  shareBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' },
  howItWorks: { paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  stepNumText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  stepText: { fontSize: 15, color: theme.colors.textDim, flex: 1 },
});

export default ReferEarnScreen;
