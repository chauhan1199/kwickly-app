import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import { Clock, CheckSquare, Square, UploadCloud } from 'lucide-react-native';

const WorkerActiveJobScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);
  
  const { jobId } = route.params || { jobId: 'mock-id' };
  
  const [seconds, setSeconds] = useState(1458); 
  const [completing, setCompleting] = useState(false);
  const [report, setReport] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Inspect the problem', checked: true },
    { id: 2, text: 'Service/repair done', checked: false },
    { id: 3, text: 'Test after completion', checked: false },
    { id: 4, text: 'Customer sign-off', checked: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleCompleteJob = async () => {
    const allChecked = checklist.every(item => item.checked);
    if (!allChecked) {
      return Alert.alert('Incomplete', 'Please check all items in the checklist before completing the job.');
    }
    if (!mediaUrl) {
      return Alert.alert('Incomplete', 'Please provide a completion media URL.');
    }
    
    setCompleting(true);
    try {
      await jobService.completeJob(jobId, {
        media: [mediaUrl],
        report: report
      });
      navigation.navigate('WorkerJobComplete');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete job');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Work in Progress</Text>
          <Text style={styles.appBarSub}>Job ID: {jobId.substring(0,6)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Timer Card */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeaderRow}>
            <Clock size={16} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.timerLabel}>WORK TIMER</Text>
          </View>
          <Text style={styles.timerValue}>{formatTime(seconds)}</Text>
          <Text style={styles.timerSub}>Job started successfully</Text>
        </View>

        {/* Job Checklist */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Job Checklist</Text>
          
          <View style={styles.checklistContainer}>
            {checklist.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.checkItem}
                onPress={() => toggleCheck(item.id)}
              >
                {item.checked ? (
                  <View style={[styles.checkBox, { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
                    <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>✓</Text>
                  </View>
                ) : (
                  <View style={[styles.checkBox, { backgroundColor: theme.colors.primary + '26', borderColor: theme.colors.primary }]} />
                )}
                <Text style={[styles.checkText, item.checked && styles.checkTextDone]}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Media Uploads */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Completion Media</Text>
          <Text style={styles.sectionSub}>Provide media proof before completion</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Image URL"
            placeholderTextColor={theme.colors.textDim}
            value={mediaUrl}
            onChangeText={setMediaUrl}
          />
        </View>

        {/* Completion Report */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Completion Report</Text>
          <Text style={styles.sectionSub}>Any notes for the customer?</Text>
          
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Type your notes here..."
            placeholderTextColor={theme.colors.textDim}
            multiline
            value={report}
            onChangeText={setReport}
          />
        </View>

        {/* Complete Button */}
        <TouchableOpacity 
          style={styles.completeBtn}
          onPress={handleCompleteJob}
          disabled={completing}
        >
          {completing ? <ActivityIndicator color="#001016" /> : <Text style={styles.completeBtnText}>Mark Job Complete ✓</Text>}
        </TouchableOpacity>

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
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  timerCard: {
    backgroundColor: '#10b981', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20,
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  timerHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timerLabel: { color: 'white', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  timerValue: { fontSize: 48, fontWeight: '900', color: 'white', letterSpacing: 2, marginBottom: 8 },
  timerSub: { color: '#d1fae5', fontSize: 14, fontWeight: '500' },
  sectionCard: {
    backgroundColor: theme.colors.surface, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  sectionSub: { fontSize: 12, color: theme.colors.textDim, marginTop: 4, marginBottom: 16 },
  checklistContainer: { marginTop: 16, gap: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'center' },
  checkBox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    marginRight: 12, justifyContent: 'center', alignItems: 'center',
  },
  checkText: { fontSize: 15, color: theme.colors.text, fontWeight: '500' },
  checkTextDone: { color: theme.colors.textDim, textDecorationLine: 'line-through' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  completeBtn: {
    backgroundColor: theme.colors.primary, width: '100%', paddingVertical: 18,
    borderRadius: 16, alignItems: 'center', marginTop: 10,
  },
  completeBtnText: { color: '#001016', fontSize: 16, fontWeight: '800' }
});

export default WorkerActiveJobScreen;
