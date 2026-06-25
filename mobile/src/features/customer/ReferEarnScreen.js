import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Share,
  Linking,
  Alert
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const ReferEarnScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const inviteCode = user?.referralCode || (user?.name ? user.name.split(' ')[0].toUpperCase() + '100' : 'KWICKLY100');

  const messageToShare = `Hey! Join me on Kwickly! Use my invite code ${inviteCode} to get ₹50 off your first service. Let's make life easier! 🚀`;

  const handleCopy = () => {
    // RNCClipboard requires a native rebuild. Fallback to Share for the code.
    Share.share({ message: inviteCode }).catch(e => console.log(e));
  };

  const handleShare = async () => {
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
      console.log('Share error', error);
      // Failsafe fallback
      Share.share({ message: messageToShare }).catch(e => console.log(e));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Refer & Earn</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <View style={styles.heroBox}>
          <Text style={{fontSize: 70, marginBottom: 20}}>🎁</Text>
          <Text style={styles.heroTitle}>Invite Friends & Earn</Text>
          <Text style={styles.heroSub}>Get ₹100 in your wallet for every friend who completes their first service.</Text>
        </View>

        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Your Invite Code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{inviteCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#25D366', borderColor: '#25D366' }]} onPress={handleShare}>
          <Text style={[styles.shareBtnText, { color: '#fff' }]}>Share via WhatsApp</Text>
        </TouchableOpacity>

        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How it works</Text>
          
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Share your code with friends</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>They get ₹50 off their first booking</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>You get ₹100 when their booking completes</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginLeft: 12 },
  content: { padding: 20 },
  heroBox: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  heroSub: { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  codeContainer: {
    backgroundColor: theme.colors.surface, borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center'
  },
  codeLabel: { fontSize: 13, color: theme.colors.textDim, marginBottom: 10 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed'
  },
  codeText: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: 2, marginRight: 20 },
  copyBtn: { backgroundColor: theme.colors.primary + '26', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  copyBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
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
