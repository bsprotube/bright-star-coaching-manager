import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import CodeInput from '../../components/CodeInput';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// The actual check-in flow, split out from the Home menu so Home can be a
// launcher rather than double as the check-in form. A student who's already
// checked in for the day, or whose teacher hasn't opened a session yet,
// lands on this same screen either way — only the middle card changes.
const AttendanceCheckInScreen = ({ navigation }) => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [studentDetails, setStudentDetails] = useState(null);

  const [checkedInToday, setCheckedInToday] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [activeCodeExists, setActiveCodeExists] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Last month and this month, each as { present, absent, total, percentage }.
  // "Late" counts as attended here — this card only distinguishes two things
  // (showed up or didn't), matching the two-way split it actually displays,
  // rather than adding a third bucket nothing on this screen shows.
  const [lastMonthStats, setLastMonthStats] = useState(null);
  const [thisMonthStats, setThisMonthStats] = useState(null);

  // Stable for the component's lifetime — recomputing per render is harmless,
  // but memoized since loadState also needs the identical keys to bucket by.
  const thisMonthKey = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const lastMonthKey = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .substring(0, 7);
  }, []);

  const summariseMonth = (records, monthKey) => {
    const inMonth = records.filter((r) => r.date.startsWith(monthKey));
    const present = inMonth.filter((r) => r.status === 'present' || r.status === 'late').length;
    const absent = inMonth.filter((r) => r.status === 'absent').length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, percentage };
  };

  const loadState = async () => {
    try {
      const profileRes = await api.get(`/students/${user.id}`);
      if (profileRes.data.success) {
        const profileData = profileRes.data.data.profile;
        setStudentDetails(profileData);

        if (profileData.batchId) {
          const codeRes = await api.get(`/attendance/code/active/${profileData.batchId}`);
          if (codeRes.data.success) {
            setActiveCodeExists(codeRes.data.active);
          }
        }
      }

      const historyRes = await api.get(`/attendance/history/student/${user.id}`);
      if (historyRes.data.success) {
        const records = historyRes.data.data;
        const todayStr = new Date().toISOString().substring(0, 10);
        const match = records.find((r) => r.date === todayStr);
        if (match) {
          setCheckedInToday(true);
          setTodayRecord(match);
        } else {
          setCheckedInToday(false);
          setTodayRecord(null);
        }

        setThisMonthStats(summariseMonth(records, thisMonthKey));
        setLastMonthStats(summariseMonth(records, lastMonthKey));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCodeInput('');
    loadState();
  }, []);

  // RN's Alert.alert() is a silent no-op on react-native-web, which is the
  // build every student actually uses.
  const showMessage = (title, msg) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const getMonthMeta = (monthKey) => {
    const [year, m] = monthKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, m - 1, 1));
    return {
      abbr: d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
      full: d.toLocaleString('default', { month: 'long', timeZone: 'UTC' }),
      year,
    };
  };

  // Renders one of the two "Last Month" / "This Month" summary cards. A plain
  // bordered circle stands in for the percentage ring — the app doesn't pull in
  // a charting library anywhere else (AttendanceHistoryScreen does the same
  // thing for its own presence circle), so this doesn't introduce one just for
  // an animated arc.
  const renderMonthCard = (title, monthKey, stats) => {
    if (!stats) return null;
    const meta = getMonthMeta(monthKey);
    return (
      <Card style={styles.monthCard}>
        <View style={styles.monthCardHeader}>
          <View style={styles.calendarBadge}>
            <Text style={styles.calendarBadgeMonth}>{meta.abbr}</Text>
            <Text style={styles.calendarBadgeYear}>{meta.year}</Text>
          </View>
          <View style={styles.monthCardTitleCol}>
            <Text style={styles.monthCardTitle}>{title}</Text>
            <Text style={styles.monthCardSubtitle}>{meta.full} {meta.year}</Text>
          </View>
          <View style={styles.totalClassesPill}>
            <Text style={styles.totalClassesLabel}>Total Classes</Text>
            <Text style={styles.totalClassesValue}>{stats.total}</Text>
          </View>
        </View>

        <View style={styles.monthCardStatsRow}>
          <View style={[styles.statCol, styles.statColBordered]}>
            <View style={styles.statIconRow}>
              <View style={[styles.statIconCircle, { backgroundColor: COLORS.success }]}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
              <Text style={[styles.statNumber, { color: COLORS.success }]}>{stats.present}</Text>
            </View>
            <Text style={styles.statLabel}>Present</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${stats.percentage}%`, backgroundColor: COLORS.success },
                ]}
              />
            </View>
            <Text style={[styles.progressPct, { color: COLORS.success }]}>{stats.percentage}%</Text>
          </View>

          <View style={[styles.statCol, styles.statColBordered]}>
            <View style={styles.statIconRow}>
              <View style={[styles.statIconCircle, { backgroundColor: COLORS.error }]}>
                <Ionicons name="close" size={13} color="#fff" />
              </View>
              <Text style={[styles.statNumber, { color: COLORS.error }]}>{stats.absent}</Text>
            </View>
            <Text style={styles.statLabel}>Absent</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${100 - stats.percentage}%`, backgroundColor: COLORS.error },
                ]}
              />
            </View>
            <Text style={[styles.progressPct, { color: COLORS.error }]}>{100 - stats.percentage}%</Text>
          </View>

          <View style={styles.statCol}>
            <View style={styles.ring}>
              <Text style={styles.ringPct}>{stats.percentage}%</Text>
            </View>
            <Text style={styles.ringLabel}>Attendance</Text>
          </View>
        </View>
      </Card>
    );
  };

  const handleCheckInSubmit = async () => {
    if (!codeInput || codeInput.length < 2) {
      showMessage('Required', 'Please enter the 2-digit attendance code');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/attendance/check-in', {
        batchId: studentDetails.batchId,
        code: codeInput,
      });

      if (res.data.success) {
        showMessage('Success', 'Checked in successfully!');
        setCheckedInToday(true);
        setTodayRecord(res.data.data);
        loadState();
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'Check-in failed. Please verify the code.';
      showMessage('Check-In Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header
          title="Attendance Check-In"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
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

          {renderMonthCard('Last Month Attendance', lastMonthKey, lastMonthStats)}
          {renderMonthCard('This Month Attendance', thisMonthKey, thisMonthStats)}

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
  monthCard: {
    marginTop: 16,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  calendarBadgeMonth: {
    backgroundColor: COLORS.error,
    color: COLORS.text,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 3,
  },
  calendarBadgeYear: {
    flex: 1,
    backgroundColor: COLORS.text,
    color: COLORS.background,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  monthCardTitleCol: {
    flex: 1,
  },
  monthCardTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  monthCardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  totalClassesPill: {
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  totalClassesLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  totalClassesValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: 'bold',
  },
  monthCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statColBordered: {
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  statNumber: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  progressTrack: {
    width: '80%',
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPct: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPct: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  ringLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 6,
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

export default AttendanceCheckInScreen;
