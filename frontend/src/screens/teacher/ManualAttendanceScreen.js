import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api, { BASE_URL } from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';
import { AuthContext } from '../../context/AuthContext';

const PAYMENT_METHODS = [
  { id: 'cash', label: '💵 Cash' },
  { id: 'upi', label: '📱 UPI' },
  { id: 'card', label: '💳 Card' },
  { id: 'bank_transfer', label: '🏛️ Bank' },
];

const ManualAttendanceScreen = ({ route, navigation }) => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
  const { batchId, batchName } = route.params;

  // This screen is mounted by both the admin and teacher navigators. The roster
  // shows everyone's dues either way, but only an admin can take money — the
  // collect endpoint is admin-only, so showing a teacher the button would just
  // hand them a 403.
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [date, setDate] = useState('');
  const [students, setStudents] = useState([]);
  const [submittingId, setSubmittingId] = useState(null); // track which student is updating

  // Collecting fees without leaving the register: a student who turns up with
  // last month's fees can be settled at the same moment they're marked present,
  // instead of the admin having to remember and go hunting in Fee Management.
  const [collectFor, setCollectFor] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectError, setCollectError] = useState('');
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10);
    setDate(today);
  }, []);

  const fetchRoster = async () => {
    if (!date) return;
    
    try {
      const res = await api.get(`/attendance/history/batch/${batchId}?date=${date}`);
      if (res.data.success) {
        setStudents(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching roster', error);
      Alert.alert('Error', 'Failed to load class roster');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [date]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRoster();
  }, [date]);

  const handleMarkStatus = async (studentId, targetStatus) => {
    setSubmittingId(studentId);
    try {
      const res = await api.post('/attendance/mark-manual', {
        studentId,
        batchId,
        date,
        status: targetStatus,
      });

      if (res.data.success) {
        // Update local status state immediately for responsive feedback
        setStudents((prev) =>
          prev.map((s) =>
            s.studentId === studentId
              ? { ...s, status: targetStatus, markedBy: 'teacher' }
              : s
          )
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Failed', 'Failed to update attendance status');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleOpenCollect = (student) => {
    setCollectFor(student);
    setCollectAmount(String(student.pendingFeeAmount));
    setCollectMethod('cash');
    setCollectError('');
  };

  const handleCollect = async () => {
    setCollectError('');
    const numAmount = Number(collectAmount);

    if (!collectAmount || !Number.isFinite(numAmount) || numAmount <= 0) {
      setCollectError('Please enter a valid amount');
      return;
    }
    if (numAmount > collectFor.pendingFeeAmount) {
      setCollectError(`Max allowed: ₹${collectFor.pendingFeeAmount}`);
      return;
    }

    setCollecting(true);
    try {
      const res = await api.post('/fees/collect', {
        studentId: collectFor.studentId,
        amount: numAmount,
        paymentMethod: collectMethod,
      });

      if (res.data.success) {
        const { remainingDues, monthsSettled } = res.data.data;
        const msg =
          remainingDues > 0
            ? `₹${numAmount} collected across ${monthsSettled.length} month(s). ₹${remainingDues} still due.`
            : `₹${numAmount} collected. All dues cleared.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Payment recorded', msg);

        setCollectFor(null);
        fetchRoster(); // dues on the roster are now stale
      }
    } catch (error) {
      console.error('Collect fee error', error);
      setCollectError(error.response?.data?.message || 'Could not record the payment');
    } finally {
      setCollecting(false);
    }
  };

  const renderStudentRow = ({ item }) => {
    const isUpdating = submittingId === item.studentId;

    return (
      <Card style={styles.rosterCard}>
        <View style={styles.rosterRow}>
          {item.photoUrl ? (
            <Image
              source={{ uri: `${BASE_URL.replace('/api', '')}${item.photoUrl}` }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{item.name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.studentDetails}>
            <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rollText}>Roll: {item.rollNumber}</Text>
            {item.pendingFeeAmount > 0 ? (
              isAdmin ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenCollect(item)}
                  style={styles.pendingFeeTapTarget}
                >
                  <Text style={styles.pendingFeeTextTappable}>
                    💸 ₹{item.pendingFeeAmount} due ({item.pendingFeeMonths} month{item.pendingFeeMonths > 1 ? 's' : ''}) › Collect
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.pendingFeeText}>
                  💸 ₹{item.pendingFeeAmount} due ({item.pendingFeeMonths} month{item.pendingFeeMonths > 1 ? 's' : ''})
                </Text>
              )
            ) : null}
          </View>

          {isUpdating ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : (
            <View style={styles.statusActions}>
              {/* Present Pill */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.pillBtn,
                  styles.pillPresent,
                  item.status === 'present' && styles.pillPresentActive,
                ]}
                onPress={() => handleMarkStatus(item.studentId, 'present')}
              >
                <Text
                  style={[
                    styles.pillText,
                    styles.textPresent,
                    item.status === 'present' && styles.pillTextActive,
                  ]}
                >
                  P
                </Text>
              </TouchableOpacity>

              {/* Late Pill */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.pillBtn,
                  styles.pillLate,
                  item.status === 'late' && styles.pillLateActive,
                ]}
                onPress={() => handleMarkStatus(item.studentId, 'late')}
              >
                <Text
                  style={[
                    styles.pillText,
                    styles.textLate,
                    item.status === 'late' && styles.pillTextActive,
                  ]}
                >
                  L
                </Text>
              </TouchableOpacity>

              {/* Absent Pill */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.pillBtn,
                  styles.pillAbsent,
                  item.status === 'absent' && styles.pillAbsentActive,
                ]}
                onPress={() => handleMarkStatus(item.studentId, 'absent')}
              >
                <Text
                  style={[
                    styles.pillText,
                    styles.textAbsent,
                    item.status === 'absent' && styles.pillTextActive,
                  ]}
                >
                  A
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header
          title={`Roster: ${batchName}`}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.dateBar}>
          <Input
            label="Attendance Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="e.g. 2026-06-23"
            style={styles.dateInput}
          />
        </View>

        {!loading && students.some(s => s.pendingFeeAmount > 0) ? (
          <View style={styles.feeSummaryBar}>
            <Text style={styles.feeSummaryText}>
              💸 {students.filter(s => s.pendingFeeAmount > 0).length} student(s) with pending fees — Total: ₹
              {students.reduce((sum, s) => sum + (s.pendingFeeAmount || 0), 0)}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.studentId}
          renderItem={renderStudentRow}
          style={scrollStyle}
          contentContainerStyle={styles.listContainer}
          refreshControl={webRefreshControl(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No students enrolled in this batch.</Text>
            </View>
          }
        />
      )}

      {/* Collect fees without leaving the register */}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(collectFor)}
        onRequestClose={() => setCollectFor(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {collectFor && (
              <>
                <Text style={styles.modalTitle}>Collect Fee</Text>

                <Card style={styles.modalSummaryCard}>
                  <Text style={styles.summaryLabel}>
                    Student: <Text style={styles.summaryVal}>{collectFor.name}</Text>
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Total Due:{' '}
                    <Text style={[styles.summaryVal, { color: COLORS.error }]}>
                      ₹{collectFor.pendingFeeAmount}
                    </Text>{' '}
                    across {collectFor.pendingFeeMonths} month
                    {collectFor.pendingFeeMonths > 1 ? 's' : ''}
                  </Text>
                </Card>

                <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
                  <Text style={styles.modalHelpText}>
                    The amount is applied to the oldest unpaid month first. Pay less
                    than the total to clear only part of the arrears.
                  </Text>

                  <Input
                    label="Amount Collected (₹) *"
                    value={collectAmount}
                    onChangeText={setCollectAmount}
                    placeholder="Enter amount received"
                    keyboardType="numeric"
                    error={collectError}
                  />

                  <Text style={styles.payMethodLabel}>Payment Channel *</Text>
                  <View style={styles.payMethodGrid}>
                    {PAYMENT_METHODS.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.payMethodChip,
                          collectMethod === m.id && styles.payMethodChipActive,
                        ]}
                        onPress={() => setCollectMethod(m.id)}
                      >
                        <Text
                          style={[
                            styles.payMethodChipText,
                            collectMethod === m.id && styles.payMethodChipTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      type="secondary"
                      onPress={() => setCollectFor(null)}
                      style={styles.modalActionBtn}
                    />
                    <Button
                      title="Record Payment"
                      onPress={handleCollect}
                      loading={collecting}
                      style={[styles.modalActionBtn, { marginLeft: 12 }]}
                    />
                  </View>
                </ScrollView>
              </>
            )}
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  dateBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  dateInput: {
    marginBottom: 8,
  },
  feeSummaryBar: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    marginHorizontal: SPACING.md,
    marginBottom: 8,
    padding: 10,
  },
  feeSummaryText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rosterCard: {
    marginBottom: 10,
    padding: 12,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentDetails: {
    flex: 1,
    paddingRight: 12,
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  rollText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  pendingFeeText: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 3,
  },
  // Same line, but underlined and padded out into a finger-sized target once it's
  // an admin looking at it, so it reads as something you can act on rather than a
  // label that happens to be tappable.
  pendingFeeTapTarget: {
    marginTop: 3,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pendingFeeTextTappable: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: SPACING.md,
    maxHeight: '85%',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 14,
    textAlign: 'center',
  },
  modalSummaryCard: {
    marginBottom: 14,
    paddingVertical: 12,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 4,
  },
  summaryVal: {
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  modalForm: {
    flexGrow: 0,
  },
  modalHelpText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 14,
    lineHeight: 18,
  },
  payMethodLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 8,
  },
  payMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  payMethodChip: {
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  payMethodChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  payMethodChipText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  payMethodChipTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
  },
  modalActionBtn: {
    flex: 1,
  },
  loader: {
    width: 120,
    justifyContent: 'center',
  },
  statusActions: {
    flexDirection: 'row',
    width: 120,
    justifyContent: 'space-between',
  },
  pillBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  pillPresent: {
    borderColor: COLORS.success,
    backgroundColor: 'transparent',
  },
  pillPresentActive: {
    backgroundColor: COLORS.success,
  },
  pillLate: {
    borderColor: COLORS.warning,
    backgroundColor: 'transparent',
  },
  pillLateActive: {
    backgroundColor: COLORS.warning,
  },
  pillAbsent: {
    borderColor: COLORS.error,
    backgroundColor: 'transparent',
  },
  pillAbsentActive: {
    backgroundColor: COLORS.error,
  },
  pillText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
  },
  textPresent: {
    color: COLORS.success,
  },
  textLate: {
    color: COLORS.warning,
  },
  textAbsent: {
    color: COLORS.error,
  },
  pillTextActive: {
    color: COLORS.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
});

export default ManualAttendanceScreen;
