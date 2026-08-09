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
  TouchableOpacity,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import CodeInput from '../../components/CodeInput';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const StudentDashboard = () => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
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

  // Outstanding fees, summarised for the banner at the top of this screen. Students
  // rarely open the Fees tab on their own, so arrears used to go unnoticed until
  // someone chased them in person; putting the figure on the screen they do open
  // every day is the whole point of showing it here.
  const [feeSummary, setFeeSummary] = useState(null);

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

      // 3. Summarise anything still owed. The oldest unpaid cycle is the one worth
      // naming: it's the date the student is already past, not the next one coming.
      const feeRes = await api.get(`/fees/student/${user.id}`);
      if (feeRes.data.success) {
        const unpaid = (feeRes.data.data || []).filter(
          (r) => r.status === 'pending' || r.status === 'partial'
        );
        if (unpaid.length > 0) {
          const totalDue = unpaid.reduce((sum, r) => sum + (r.amountDue - r.amountPaid), 0);
          const oldest = unpaid.reduce((a, b) => (a.billingMonth <= b.billingMonth ? a : b));
          setFeeSummary({
            totalDue,
            monthsPending: unpaid.length,
            oldestDueDate: oldest.dueDate,
            anyPartial: unpaid.some((r) => r.status === 'partial'),
          });
        } else {
          setFeeSummary(null);
        }
      }

      // 4. Fetch check-in history to verify if checked in today
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
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header title="Class Check-In" />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={scrollStyle}
          contentContainerStyle={styles.container}
          refreshControl={webRefreshControl(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          )}
        >
          {/* Outstanding fees — deliberately the first thing on the screen, and
              deliberately loud. Tapping anywhere on it opens the full ledger.
              There is no online payment in this app: fees are handed over at the
              centre, so the banner says where to pay rather than offering a
              button that couldn't do anything. */}
          {feeSummary ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.feeBanner}
              onPress={() => navigation.navigate('Fees')}
            >
              <View style={styles.feeBannerTop}>
                <View style={styles.feeBannerIcon}>
                  <Text style={styles.feeBannerIconText}>💰</Text>
                </View>
                <View style={styles.feeBannerTextCol}>
                  <Text style={styles.feeBannerLabel}>FEES DUE</Text>
                  <Text style={styles.feeBannerAmount}>
                    ₹{feeSummary.totalDue.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.feeBannerMeta}>
                    {feeSummary.monthsPending} month
                    {feeSummary.monthsPending > 1 ? 's' : ''} pending
                    {feeSummary.oldestDueDate
                      ? ` · since ${new Date(feeSummary.oldestDueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.feeBannerFooter}>
                <Text style={styles.feeBannerFooterText}>
                  Please pay at the coaching centre
                </Text>
                <Text style={styles.feeBannerLink}>View Details →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

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
    paddingBottom: 80,
  },
  // Sized to be the loudest thing on the screen: a tinted red slab with the figure
  // set large enough to read at a glance, so an unpaid balance is impossible to
  // scroll past on the way to the check-in box.
  feeBanner: {
    backgroundColor: COLORS.error + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  feeBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.error + '2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  feeBannerIconText: {
    fontSize: 24,
  },
  feeBannerTextCol: {
    flex: 1,
  },
  feeBannerLabel: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 1.2,
  },
  feeBannerAmount: {
    color: COLORS.error,
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 44,
  },
  feeBannerMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  feeBannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.error + '33',
  },
  feeBannerFooterText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    flex: 1,
  },
  feeBannerLink: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginLeft: 10,
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
