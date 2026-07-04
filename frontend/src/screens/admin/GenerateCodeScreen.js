import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import api from '../../services/api';

const GenerateCodeScreen = ({ navigation }) => {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  
  // Selection configurations
  const [duration, setDuration] = useState(15); // Default 15 minutes
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Code and timer states
  const [activeCode, setActiveCode] = useState('');
  const [expiryTime, setExpiryTime] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/batches');
        if (res.data.success) {
          setBatches(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedBatch(res.data.data[0]);
          }
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load batches');
      } finally {
        setLoadingBatches(false);
      }
    };

    fetchBatches();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fetch active code for selected batch if any exists
  useEffect(() => {
    if (!selectedBatch) return;

    const checkActiveCode = async () => {
      try {
        const res = await api.get(`/attendance/code/active/${selectedBatch._id}`);
        if (res.data.success && res.data.active) {
          // If code was generated elsewhere, grab it (requires admin/teacher auth to read actual code)
          setActiveCode(res.data.code);
          setExpiryTime(new Date(res.data.expiresAt));
        } else {
          setActiveCode('');
          setExpiryTime(null);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkActiveCode();
  }, [selectedBatch]);

  // Countdown timer logic
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!expiryTime) {
      setSecondsRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      const diff = Math.max(0, Math.floor((expiryTime.getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        setActiveCode('');
        setExpiryTime(null);
        if (timerRef.current) clearInterval(timerRef.current);

        // Immediately notify the backend the code just expired, so it can
        // auto-mark absentees right away instead of waiting for someone to
        // reopen this screen later.
        if (selectedBatch) {
          api.get(`/attendance/code/active/${selectedBatch._id}`).catch((e) => console.error(e));
        }
      }
    };

    calculateRemaining();
    timerRef.current = setInterval(calculateRemaining, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiryTime]);

  const handleGenerate = async () => {
    if (!selectedBatch) {
      Alert.alert('Error', 'Please select a batch first');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/attendance/code/generate', {
        batchId: selectedBatch._id,
        expiryMinutes: duration,
      });

      if (res.data.success) {
        setActiveCode(res.data.data.code);
        setExpiryTime(new Date(res.data.data.expiresAt));
        Alert.alert('Success', `Attendance code ${res.data.data.code} generated successfully.`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const durationsList = [5, 10, 15, 30, 45, 60];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Generate Attendance" showBackButton onBackPress={() => navigation.goBack()} />

      <View style={styles.container}>
        {/* Selection Card */}
        <Card style={styles.configCard}>
          <Text style={styles.label}>Select Classroom Batch</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.dropdown}
            onPress={() => setBatchModalVisible(true)}
          >
            <Text style={styles.dropdownValue}>
              {selectedBatch ? selectedBatch.name : 'Loading batches...'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16 }]}>Expiration Code Limit</Text>
          <View style={styles.durationGrid}>
            {durationsList.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.durationChip, duration === d && styles.durationChipActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>
                  {d} Mins
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Generate Today's Code"
            onPress={handleGenerate}
            loading={generating}
            disabled={loadingBatches}
            style={styles.generateBtn}
          />
        </Card>

        {/* Display Generated Code */}
        {activeCode ? (
          <Card style={styles.codeCard}>
            <Text style={styles.codeHeader}>Active Attendance Code</Text>
            <Text style={styles.codeSubHeader}>For batch: {selectedBatch?.name}</Text>
            
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{activeCode}</Text>
            </View>

            <View style={styles.timerRow}>
              <Text style={styles.timerText}>Code Expires In: </Text>
              <Text style={styles.timerCountdown}>{formatTimer(secondsRemaining)}</Text>
            </View>
            <Text style={styles.codeInstructions}>
              Ask students to open their app and enter this code.
            </Text>
          </Card>
        ) : (
          <Card style={styles.noCodeCard}>
            <Text style={styles.noCodeEmoji}>🔑</Text>
            <Text style={styles.noCodeText}>No active code generated for this batch.</Text>
            <Text style={styles.noCodeSubText}>Select a batch and click generate to open check-in access.</Text>
          </Card>
        )}
      </View>

      {/* Batch selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={batchModalVisible}
        onRequestClose={() => setBatchModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Batch</Text>
            {loadingBatches ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <FlatList
                data={batches}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.batchItem}
                    onPress={() => {
                      setSelectedBatch(item);
                      setBatchModalVisible(false);
                    }}
                  >
                    <Text style={styles.batchItemText}>{item.name}</Text>
                    <Text style={styles.batchItemSchedule}>{item.schedule || 'No schedule'}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <Button
              title="Close"
              type="secondary"
              onPress={() => setBatchModalVisible(false)}
              style={styles.modalCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
    flex: 1,
  },
  configCard: {
    paddingVertical: 20,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  dropdown: {
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
  },
  dropdownArrow: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  durationChip: {
    width: '31%',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durationChipActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  durationText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
  },
  durationTextActive: {
    color: COLORS.primaryLight,
    fontWeight: 'bold',
  },
  generateBtn: {
    marginTop: 10,
  },
  codeCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  codeHeader: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  codeSubHeader: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 4,
  },
  codeBox: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    letterSpacing: 4,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  timerCountdown: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: 'bold',
  },
  codeInstructions: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
  noCodeCard: {
    alignItems: 'center',
    paddingVertical: 40,
    justifyContent: 'center',
  },
  noCodeEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noCodeText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  noCodeSubText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxHeight: '70%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 16,
    textAlign: 'center',
  },
  batchItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  batchItemText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  batchItemSchedule: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 16,
  },
});

export default GenerateCodeScreen;