import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  Image,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getItem } from '../../utils/storage';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import api, { API_URL, BASE_URL } from '../../services/api';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_WIDTH = 34;
const NAME_COL_WIDTH = 170;
const ROLL_COL_WIDTH = 56;
const SUMMARY_COL_WIDTH = 60;
const FEE_COL_WIDTH = 100;
const AVATAR_SIZE = 32;

// On web, use a plain View with native CSS overflow for the horizontal
// scroller instead of RN's ScrollView — ScrollView's JS-based wheel handling
// was fighting with the page-level vertical scroll and causing a jittery/
// shaking feel. Native mobile still needs the real ScrollView for touch scroll.
const HScrollWrapper = Platform.OS === 'web' ? View : ScrollView;

const AttendanceRegisterScreen = ({ navigation, route }) => {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(route.params?.batch || null);
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [register, setRegister] = useState(null);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/batches');
        if (res.data.success) {
          setBatches(res.data.data);
          if (!selectedBatch && res.data.data.length > 0) {
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
  }, []);

  const fetchRegister = useCallback(async () => {
    if (!selectedBatch) return;
    setLoadingRegister(true);
    try {
      const res = await api.get(`/attendance/register/${selectedBatch._id}`, {
        params: { month },
      });
      if (res.data.success) {
        setRegister(res.data);
      }
    } catch (error) {
      console.error('Error fetching attendance register', error);
      Alert.alert('Error', 'Failed to load attendance register');
    } finally {
      setLoadingRegister(false);
    }
  }, [selectedBatch, month]);

  useEffect(() => {
    fetchRegister();
  }, [fetchRegister]);

  const changeMonth = (direction) => {
    const [year, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(year, m - 1 + direction, 1));
    setMonth(d.toISOString().substring(0, 7));
  };

  const formatMonthLabel = (monthStr) => {
    const [year, m] = monthStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, m - 1, 1));
    return d.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const getWeekdayLetter = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return DAY_LABELS[d.getUTCDay()];
  };

  const getCellDisplay = (status, isClassDay) => {
    if (status === 'present') return { text: 'P', style: styles.cellPresent };
    if (status === 'absent') return { text: 'A', style: styles.cellAbsent };
    if (status === 'late') return { text: 'L', style: styles.cellLate };
    if (isClassDay === false) return { text: 'H', style: styles.cellHoliday };
    return { text: '–', style: styles.cellEmpty };
  };

  const handleExportExcel = async () => {
    if (!selectedBatch) return;
    setDownloading(true);
    try {
      const token = await getItem('user_token');
      const downloadUrl = `${API_URL}/reports/monthly-attendance?format=excel&batchId=${selectedBatch._id}&month=${month}`;
      const filename = `attendance_register_${selectedBatch.name.replace(/\s+/g, '_')}_${month}.xlsx`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (downloadResult.status === 200) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Saved', `Saved to ${downloadResult.uri}`);
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Export Failed', 'Could not export the register. Check server logs.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Attendance Register"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Top controls */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.batchDropdown}
          onPress={() => setBatchModalVisible(true)}
        >
          <Text style={styles.batchDropdownText} numberOfLines={1}>
            {selectedBatch ? selectedBatch.name : 'Select Batch'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.exportBtn}
          onPress={handleExportExcel}
          disabled={downloading || !selectedBatch}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.exportBtnText}>📊 Export Excel</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legendBar}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>Present</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>Absent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>Late</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.surfaceLight }]} />
          <Text style={styles.legendText}>Not Marked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(148, 163, 184, 0.5)' }]} />
          <Text style={styles.legendText}>Holiday (H)</Text>
        </View>
      </View>

      {loadingRegister || loadingBatches ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !register || register.rows.length === 0 ? (
        <View style={styles.loaderContainer}>
          <Text style={styles.emptyText}>No students enrolled in this batch.</Text>
        </View>
      ) : (
        <>
          {/* Register Table: horizontal scroll for dates; vertical scroll is
              handled by the page-level root scroll (see App.js), not nested here.
              On web we use a plain native-overflow View instead of RN's ScrollView
              component here, because ScrollView's JS wheel-handling was fighting
              with the page's vertical scroll and causing a "shaking"/jitter feel. */}
          <View style={styles.tableWrapper}>
            <HScrollWrapper
              {...(Platform.OS === 'web'
                ? { style: [styles.hScroll, styles.hScrollWeb] }
                : { horizontal: true, style: styles.hScroll, contentContainerStyle: styles.hScrollContent })}
            >
              <View style={Platform.OS === 'web' ? styles.hScrollContent : undefined}>
                {/* Header row */}
                <View style={styles.headerRow}>
                  <View style={[styles.headCell, { width: ROLL_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Roll</Text>
                  </View>
                  <View style={[styles.headCell, { width: NAME_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Name</Text>
                  </View>
                  {register.rows[0].days.map((d, idx) => (
                    <View key={idx} style={[styles.dateHeadCell, { width: CELL_WIDTH }]}>
                      <Text style={styles.dateHeadNum}>{idx + 1}</Text>
                      <Text style={styles.dateHeadDay}>{getWeekdayLetter(d.date)}</Text>
                    </View>
                  ))}
                  <View style={[styles.headCell, { width: SUMMARY_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Pres.</Text>
                  </View>
                  <View style={[styles.headCell, { width: SUMMARY_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Abs.</Text>
                  </View>
                  <View style={[styles.headCell, { width: SUMMARY_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>%</Text>
                  </View>
                  <View style={[styles.headCell, { width: FEE_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Admission Fee</Text>
                  </View>
                  <View style={[styles.headCell, { width: FEE_COL_WIDTH }]}>
                    <Text style={styles.headCellText}>Pending Fees</Text>
                  </View>
                </View>

                {/* Student rows */}
                {register.rows.map((student, rIdx) => (
                  <View
                    key={student.studentId}
                    style={[styles.dataRow, rIdx % 2 === 1 && styles.dataRowAlt]}
                  >
                    <View style={[styles.dataCell, { width: ROLL_COL_WIDTH }]}>
                      <Text style={styles.rollText}>{student.rollNumber}</Text>
                    </View>
                    <View style={[styles.dataCell, styles.nameCell, { width: NAME_COL_WIDTH }]}>
                      {student.photoUrl ? (
                        <Image
                          source={{ uri: `${BASE_URL.replace('/api', '')}${student.photoUrl}` }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>{student.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.nameText} numberOfLines={1}>{student.name}</Text>
                    </View>
                    {student.days.map((d, cIdx) => {
                      const cell = getCellDisplay(d.status, d.isClassDay);
                      return (
                        <View key={cIdx} style={[styles.dataCell, cell.style, { width: CELL_WIDTH }]}>
                          <Text style={styles.cellText}>{cell.text}</Text>
                        </View>
                      );
                    })}
                    <View style={[styles.dataCell, { width: SUMMARY_COL_WIDTH }]}>
                      <Text style={[styles.summaryText, { color: COLORS.success }]}>{student.presentCount}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: SUMMARY_COL_WIDTH }]}>
                      <Text style={[styles.summaryText, { color: COLORS.error }]}>{student.absentCount}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: SUMMARY_COL_WIDTH }]}>
                      <Text style={styles.summaryText}>{student.percentage}%</Text>
                    </View>
                    <View style={[styles.dataCell, { width: FEE_COL_WIDTH }]}>
                      <View style={[
                        styles.feeBadge,
                        student.admissionFeeStatus === 'paid' ? styles.feeBadgePaid : styles.feeBadgeUnpaid,
                      ]}>
                        <Text style={[
                          styles.feeBadgeText,
                          student.admissionFeeStatus === 'paid' ? styles.feeBadgeTextPaid : styles.feeBadgeTextUnpaid,
                        ]}>
                          {student.admissionFeeStatus === 'paid' ? 'PAID' : 'UNPAID'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.dataCell, { width: FEE_COL_WIDTH }]}>
                      <Text style={[
                        styles.summaryText,
                        { color: student.pendingFeesCount > 0 ? COLORS.error : COLORS.textMuted },
                      ]}>
                        {student.pendingFeesCount}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </HScrollWrapper>
          </View>

          {/* Batch Summary Cards */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Total Students</Text>
              <Text style={styles.summaryCardValue}>{register.totalStudents}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Total Present</Text>
              <Text style={[styles.summaryCardValue, { color: COLORS.success }]}>{register.summary.totalPresent}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Total Absent</Text>
              <Text style={[styles.summaryCardValue, { color: COLORS.error }]}>{register.summary.totalAbsent}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Avg Attendance</Text>
              <Text style={[styles.summaryCardValue, { color: COLORS.primaryLight }]}>{register.summary.avgAttendance}%</Text>
            </View>
          </View>
        </>
      )}

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
                  </TouchableOpacity>
                )}
              />
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
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 6,
  },
  batchDropdown: {
    flex: 1.2,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginRight: 8,
  },
  batchDropdownText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    flex: 1,
  },
  dropdownArrow: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  monthNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
    marginHorizontal: 8,
    minWidth: 80,
    textAlign: 'center',
  },
  exportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  legendBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  tableWrapper: {
    paddingBottom: 20,
  },
  hScroll: {
    flexGrow: 0,
  },
  hScrollWeb: {
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },
  hScrollContent: {
    paddingHorizontal: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headCell: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
  },
  headCellText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateHeadCell: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
  },
  dateHeadNum: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateHeadDay: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
  },
  dataRowAlt: {
    backgroundColor: COLORS.surface,
  },
  dataCell: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 8,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 8,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  feeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  feeBadgePaid: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  feeBadgeUnpaid: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  feeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  feeBadgeTextPaid: {
    color: COLORS.success,
  },
  feeBadgeTextUnpaid: {
    color: COLORS.warning,
  },
  rollText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  nameText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  cellText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cellPresent: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  cellAbsent: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  cellLate: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
  },
  cellEmpty: {
    backgroundColor: 'transparent',
  },
  cellHoliday: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  summaryText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  summaryCardLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryCardValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: 'bold',
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
});

export default AttendanceRegisterScreen;