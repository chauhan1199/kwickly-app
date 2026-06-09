import React from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const WorkerJobCanceledScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signOut } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Job Canceled</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Graphic */}
        <View style={styles.graphicBox}>
          <Text style={styles.graphicEmoji}>❌</Text>
          <Text style={styles.congratsText}>Job Canceled</Text>
          <Text style={styles.congratsSub}>The customer has canceled this request.</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Reason:</Text>
          <Text style={styles.infoText}>Found another professional who could arrive sooner.</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => navigation.navigate('WorkerApp')}
          >
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
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
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 40 },
  graphicBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  graphicEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  congratsSub: {
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 40,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  actionsContainer: {
    gap: 16,
  },
  doneBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerJobCanceledScreen;
