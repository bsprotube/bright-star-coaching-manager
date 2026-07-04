import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import CodeInput from '../../components/CodeInput';
import Button from '../../components/Button';
import api from '../../services/api';

const StudentDashboard = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Student core metadata
  const [studentDetails, setStudentDetails] = useState(null);
  
  // Attendance state
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [activeCodeExists, setActiveCodeExists] = useState(false);
  const [activeCodeExpiry, setActiveCodeExpiry] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  const loadStudentState = async () => {
    try {
      // 1. Fetch student detailed profile
      const profileRes = await api.get(`/students/${user.id}`);
      if (profileRes.data.success) {
        const profileData = profileRes.data.data.profile;
        setStudentDetails(profileData);
        
        // 2. Fetch active code check for batch
        if (profileData.batchId) {
          const codeRes = await api.get(`/attendance/code/active/${profileData.batchId}`);
          if (codeRes.data.success) {
            setActiveCodeExists(codeRes.data.active);
            setActiveCodeExpiry(codeRes.data.expiresAt ? new Date(codeRes.data.expiresAt) : null);
          }
        }
      }

      // 3. Fetch check-in history to verify if checked in today
      const historyRes = await api.get(`/attendance/history/student/${user.id}`);
      if (historyRes.data.success) {
        const todayStr = new Date().toISOString().substring(0, 10);
        const match = historyRes.data.data.find(r => r.date === todayStr);
        if (match) {
          setCheckedInToday(true);
          setTodayRecord(match);
        } else {
          setCheckedInToday(false);
          setTodayRecord(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudentState();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCodeInput('');
    loadStudentState();
  }, []);

  const handleCheckInSubmit = async () => {
    if (!codeInput || codeInput.length < 2) {
      Alert.alert('Required', 'Please enter the 2-digit attendance code');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/attendance/check-in', {
        batchId: studentDetails.batchId,
        code: codeInput,
      });

      if (res.data.success) {
        Alert.alert('Success', 'Checked in successfully!');
        setCheckedInToday(true);
        setTodayRecord(res.data.data);
        loadStudentState(); // reload details
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'Check-in failed. Please verify the code.';
      Alert.alert('Check-In Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Class Check-In" />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* Roster detail info header */}
          <View style={styles.greetingHeader}>
            <Text style={styles.greetText}>Hello, {user?.name}</Text>
            <Text style={styles.subtext}>Roll Number: {studentDetails?.rollNumber}</Text>
            <Text style={styles.subtext}>Classroom: {studentDetails?.batchName}</Text>
          </View>

          {/* Conditional Check-in Views */}
          {checkedInToday ? (
            <Card borderLeftColor={COLORS.success} style={styles.statusCard}>
              <Text style={styles.statusTitle}>Check-In Registered</Text>
              <Text style={styles.statusEmoji}>✅</Text>
              <Text style={styles.statusDetails}>
                You are marked as <Text style={styles.textGreen}>PRESENT</Text> for today.
              </Text>
              <Text style={styles.timestampText}>
                Timestamp: {new Date(todayRecord?.timestamp).toLocaleTimeString()}
              </Text>
            </Card>
          ) : activeCodeExists ? (
            <Card borderLeftColor={COLORS.primary} style={styles.checkInCard}>
              <Text style={styles.checkInTitle}>Enter Attendance Code</Text>
              <Text style={styles.checkInSubtitle}>
                A code has been generated by your teacher. Enter it below to check in.
              </Text>

              <CodeInput value={codeInput} onChangeCode={setCodeInput} />

              <Button
                title="Verify & Check-In"
                onPress={handleCheckInSubmit}
                loading={submitting}
                style={styles.submitBtn}
              />
            </Card>
          ) : (
            <Card borderLeftColor={COLORS.surfaceLight} style={styles.noCodeCard}>
              <Text style={styles.noCodeEmoji}>🔒</Text>
              <Text style={styles.noCodeTitle}>No Active Session</Text>
              <Text style={styles.noCodeSubtitle}>
                Attendance check-in is not open yet. Ask your instructor for the daily verification code.
              </Text>
              
              <Button
                title="Refresh Page"
                type="outline"
                onPress={onRefresh}
                style={styles.refreshBtn}
              />
            </Card>
          )}

          {/* Guidelines */}
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 Important Instructions</Text>
            <Text style={styles.infoBullet}>• You can only mark attendance once per day.</Text>
            <Text style={styles.infoBullet}>• The verification code expires shortly after generation.</Text>
            <Text style={styles.infoBullet}>• Duplicate logins or cross-batch check-ins will be blocked.</Text>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  greetingHeader: {
    marginBottom: 20,
  },
  greetText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  subtext: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 4,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginVertical: 10,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  statusEmoji: {
    fontSize: 48,
    marginVertical: 16,
  },
  statusDetails: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  textGreen: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  timestampText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 8,
  },
  checkInCard: {
    paddingVertical: 24,
    alignItems: 'center',
    marginVertical: 10,
  },
  checkInTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  checkInSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  submitBtn: {
    marginTop: 12,
  },
  noCodeCard: {
    alignItems: 'center',
    paddingVertical: 36,
    marginVertical: 10,
  },
  noCodeEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  noCodeTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  noCodeSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  refreshBtn: {
    marginTop: 20,
    width: '60%',
  },
  infoCard: {
    marginTop: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  infoTitle: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoBullet: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 6,
  },
});

export default StudentDashboard;
