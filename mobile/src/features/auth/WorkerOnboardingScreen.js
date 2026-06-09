import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  StatusBar, TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { ShieldCheck, Wrench, Landmark, ChevronRight, Check, Upload } from 'lucide-react-native';

const STEPS = [
  { id: 1, title: 'KYC Documents', icon: ShieldCheck, color: '#7c3aed' },
  { id: 2, title: 'Your Services',  icon: Wrench,      color: '#0e9aa7' },
  { id: 3, title: 'Bank Details',   icon: Landmark,    color: '#059669' },
];

const CATEGORIES = [
  'AC Repair', 'Plumbing', 'Electrical', 'Carpentry', 'Cleaning',
  'Painting', 'Appliance Repair', 'Pest Control', 'Gardening', 'Shifting & Moving'
];

const WorkerOnboardingScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [kycDocs, setKycDocs] = useState({ aadhar: null, pan: null });
  const [bankDetails, setBankDetails] = useState({ accountNo: '', ifsc: '', holderName: '', upiId: '' });

  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const uploadDoc = (type) => {
    Alert.alert('Upload Document', 'Camera / Gallery picker would open here', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Upload', onPress: () => setKycDocs(prev => ({ ...prev, [type]: `${type}.pdf` })) }
    ]);
  };

  const handleNext = () => {
    if (step === 1 && !kycDocs.aadhar) {
      Alert.alert('Required', 'Please upload your Aadhar card to continue');
      return;
    }
    if (step === 2 && selectedCategories.length === 0) {
      Alert.alert('Required', 'Please select at least one service category');
      return;
    }
    if (step < 3) setStep(s => s + 1);
    else {
      Alert.alert('Profile Submitted! 🎉', 'Your KYC is under review. You can start browsing jobs once approved (usually within 24h).');
    }
  };

  const renderKyc = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDesc}>Upload clear photos/scans of your ID documents. Only PDF or JPG accepted.</Text>
      {['aadhar', 'pan'].map(type => (
        <TouchableOpacity key={type} style={styles.uploadCard} onPress={() => uploadDoc(type)}>
          <View style={styles.uploadIcon}>
            <Upload size={20} color={kycDocs[type] ? '#059669' : theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadTitle}>{type === 'aadhar' ? 'Aadhar Card *' : 'PAN Card (Optional)'}</Text>
            <Text style={styles.uploadSub}>{kycDocs[type] ? `✅ ${kycDocs[type]}` : 'Tap to upload PDF or JPG'}</Text>
          </View>
          {kycDocs[type] && <Check size={20} color="#059669" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderServices = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDesc}>Select all service categories you can work in. You can change this anytime.</Text>
      <View style={styles.categoriesGrid}>
        {CATEGORIES.map(cat => {
          const selected = selectedCategories.includes(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selected && styles.catChipActive]}
              onPress={() => toggleCategory(cat)}
            >
              {selected && <Check size={12} color="#001016" />}
              <Text style={[styles.catChipText, selected && styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedCategories.length > 0 && (
        <Text style={styles.selectedCount}>{selectedCategories.length} categories selected</Text>
      )}
    </View>
  );

  const renderBank = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stepContent}>
        <Text style={styles.stepDesc}>Add your bank account to receive earnings. You can also add a UPI ID.</Text>
        {[
          { key: 'holderName', label: 'Account Holder Name', placeholder: 'As on bank records' },
          { key: 'accountNo', label: 'Account Number', placeholder: '123456789012', kb: 'numeric' },
          { key: 'ifsc', label: 'IFSC Code', placeholder: 'SBIN0001234' },
          { key: 'upiId', label: 'UPI ID (Optional)', placeholder: 'name@upi' },
        ].map(field => (
          <View key={field.key} style={{ marginBottom: 16 }}>
            <Text style={styles.inputLabel}>{field.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor={theme.colors.textDim}
              value={bankDetails[field.key]}
              onChangeText={v => setBankDetails(prev => ({ ...prev, [field.key]: v }))}
              keyboardType={field.kb || 'default'}
            />
          </View>
        ))}
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070b14" />

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <View style={[styles.stepDot, step >= s.id && styles.stepDotActive]}>
              {step > s.id
                ? <Check size={14} color="#001016" />
                : <Text style={[styles.stepDotNum, step >= s.id && { color: '#001016' }]}>{s.id}</Text>}
            </View>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, step > s.id && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>

      {/* Header */}
      <LinearGradient colors={['#0e9aa7', '#43e3eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stepHeader}>
        {React.createElement(STEPS[step - 1].icon, { size: 24, color: '#001016' })}
        <Text style={styles.stepTitle}>Step {step}: {STEPS[step - 1].title}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {step === 1 && renderKyc()}
        {step === 2 && renderServices()}
        {step === 3 && renderBank()}
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>{step === 3 ? 'Submit Profile' : 'Continue'}</Text>
          <ChevronRight size={18} color="#001016" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: theme.colors.background },
  progressBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 20 },
  stepDot:          { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive:    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  stepDotNum:       { fontSize: 13, fontWeight: '800', color: theme.colors.textDim },
  stepLine:         { flex: 1, height: 2, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  stepLineActive:   { backgroundColor: theme.colors.primary },
  stepHeader:       { marginHorizontal: 20, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stepTitle:        { fontSize: 18, fontWeight: '900', color: '#001016' },
  scroll:           { paddingHorizontal: 20, paddingTop: 12 },
  stepContent:      { gap: 12 },
  stepDesc:         { fontSize: 14, color: theme.colors.textDim, lineHeight: 20, marginBottom: 8 },
  uploadCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.border, borderStyle: 'dashed', padding: 16, gap: 14 },
  uploadIcon:       { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  uploadTitle:      { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  uploadSub:        { fontSize: 12, color: theme.colors.textDim },
  categoriesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  catChipActive:    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  catChipText:      { fontSize: 13, fontWeight: '700', color: theme.colors.textDim },
  catChipTextActive:{ color: '#001016' },
  selectedCount:    { fontSize: 13, color: theme.colors.primary, fontWeight: '700', marginTop: 4 },
  inputLabel:       { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginBottom: 6 },
  input:            { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.surface },
  footer:           { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  backBtn:          { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center' },
  backBtnText:      { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  nextBtn:          { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 16 },
  nextBtnText:      { fontSize: 16, fontWeight: '800', color: '#001016' },
});

export default WorkerOnboardingScreen;
