import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api, { BASE_URL } from '../../services/api';

const StudentListScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  // Student Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().substring(0, 7));

  const fetchBatches = async () => {
    try {
      const res = await api.get('/batches');
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async () => {
    try {
      const params = {};
      if (selectedBatchId) params.batchId = selectedBatchId;
      if (search) params.search = search;

      const res = await api.get('/students', { params });
      if (res.data.success) {
        setStudents(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching students', error);
      Alert.alert('Error', 'Failed to load student directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedBatchId, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents();
  }, [selectedBatchId, search]);

  const fetchStudentProfile = async (student, month) => {
    setStudentDetailsLoading(true);
    try {
      const res = await api.get(`/students/${student.id}`, { params: { calendarMonth: month } });
      if (res.data.success) {
        setStudentProfile(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching student profile details', error);
      Alert.alert('Error', 'Failed to load student detailed log');
      setDetailModalVisible(false);
    } finally {
      setStudentDetailsLoading(false);
    }
  };

  const handleOpenDetails = async (student) => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    setSelectedStudent(student);
    setCalendarMonth(currentMonth);
    setDetailModalVisible(true);
    setStudentProfile(null);
    await fetchStudentProfile(student, currentMonth);
  };

  const changeCalendarMonth = async (direction) => {
    if (!selectedStudent) return;
    const [year, month] = calendarMonth.split('-').map(Number);
    const newDate = new Date(Date.UTC(year, month - 1 + direction, 1));
    const newMonth = newDate.toISOString().substring(0, 7);
    setCalendarMonth(newMonth);
    await fetchStudentProfile(selectedStudent, newMonth);
  };

  const formatMonthLabel = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, 1));
    return d.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const getCalendarDays = () => {
    if (!studentProfile) return [];
    const [year, month] = calendarMonth.split('-').map(Number);
    const startOffset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const statusMap = {};
    (studentProfile.attendanceCalendar || []).forEach((rec) => {
      statusMap[rec.date] = rec.status;
    });

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarMonth}-${String(day).padStart(2, '0')}`;
      cells.push({ day, status: statusMap[dateStr] || null });
    }
    return cells;
  };

  const getCellStyle = (status) => {
    if (status === 'present') return styles.cellPresent;
    if (status === 'late') return styles.cellLate;
    if (status === 'absent') return styles.cellAbsent;
    return null;
  };

  const handleDeleteStudent = (student) => {
    Alert.alert(
      'Deactivate Student',
      `Are you sure you want to deactivate and soft-delete student "${student.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/students/${student.id}`);
              if (res.data.success) {
                Alert.alert('Success', 'Student deactivated successfully');
                setDetailModalVisible(false);
                fetchStudents();
              }
            } catch (error) {
              console.error('Deactivate student error', error);
              Alert.alert('Error', error.response?.data?.message || 'Deactivation failed');
            }
          },
        },
      ]
    );
  };

  const renderStudentItem = ({ item }) => (
    <Card style={styles.studentCard} onPress={() => handleOpenDetails(item)}>
      <View style={styles.studentRow}>
        {item.photoUrl ? (
          <Image
            source={{ uri: `${BASE_URL.replace('/api', '')}${item.photoUrl}` }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {item.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.studentInfo}>
          <View style={styles.studentHeaderRow}>
            <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rollBadge}>{item.rollNumber}</Text>
          </View>
          <Text style={styles.studentMeta}>📱 Phone: {item.phone}</Text>
          <Text style={styles.studentMeta}>📚 Batch: {item.batch}</Text>
        </View>
      </View>
    </Card>
  );

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return COLORS.success;
      case 'partial':
        return COLORS.warning;
      case 'pending':
      default:
        return COLORS.error;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Student Directory"
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditStudent')}
            style={styles.addIconBtn}
          >
            <Text style={styles.addIconText}>＋</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.searchFilterContainer}>
        <Input
          placeholder="Search by name or mobile..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
          inputStyle={styles.searchBarInput}
        />
        
        {/* Horizontal Batch Filter List */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.batchFilters}
          contentContainerStyle={styles.batchFiltersContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, !selectedBatchId && styles.filterChipActive]}
            onPress={() => setSelectedBatchId('')}
          >
            <Text style={[styles.filterChipText, !selectedBatchId && styles.filterChipTextActive]}>
              All Batches
            </Text>
          </TouchableOpacity>
          {batches.map((b) => (
            <TouchableOpacity
              key={b._id}
              style={[styles.filterChip, selectedBatchId === b._id && styles.filterChipActive]}
              onPress={() => setSelectedBatchId(b._id)}
            >
              <Text style={[styles.filterChipText, selectedBatchId === b._id && styles.filterChipTextActive]}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          style={styles.flatList}
          scrollEnabled={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No students match the criteria.</Text>
            </View>
          }
        />
      )}

      {/* Student Details Log Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {studentDetailsLoading || !studentProfile ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modalLoaderText}>Loading student profile log...</Text>
              </View>
            ) : (
              <View style={styles.profileWrapper}>
                <Text style={styles.detailTitle}>Student Log Profile</Text>

                <ScrollView style={styles.profileScroll}>
                  {/* Photo & Main Details */}
                  <View style={styles.profileHeader}>
                    {studentProfile.profile.photoUrl ? (
                      <Image
                        source={{ uri: `${BASE_URL.replace('/api', '')}${studentProfile.profile.photoUrl}` }}
                        style={styles.largeAvatar}
                      />
                    ) : (
                      <View style={styles.largeAvatarPlaceholder}>
                        <Text style={styles.largeAvatarText}>
                          {studentProfile.profile.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.largeName}>{studentProfile.profile.name}</Text>
                    <Text style={styles.largeRoll}>Roll Number: {studentProfile.profile.rollNumber}</Text>
                  </View>

                  {/* Core Details Grid */}
                  <View style={styles.profileSection}>
                    <Text style={styles.sectionHeading}>Contact Details</Text>
                    <Card style={styles.detailsSubCard}>
                      <Text style={styles.detailLabel}>📞 Student Phone: <Text style={styles.detailVal}>{studentProfile.profile.phone}</Text></Text>
                      <Text style={styles.detailLabel}>👪 Parent Phone: <Text style={styles.detailVal}>{studentProfile.profile.parentPhone}</Text></Text>
                      <Text style={styles.detailLabel}>📧 Email ID: <Text style={styles.detailVal}>{studentProfile.profile.email || 'N/A'}</Text></Text>
                      <Text style={styles.detailLabel}>🏠 Address: <Text style={styles.detailVal}>{studentProfile.profile.address}</Text></Text>
                    </Card>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionHeading}>Enrollment Setup</Text>
                    <Card style={styles.detailsSubCard}>
                      <Text style={styles.detailLabel}>🏫 Assigned Batch: <Text style={styles.detailVal}>{studentProfile.profile.batchName}</Text></Text>
                      <Text style={styles.detailLabel}>🕒 Batch Schedule: <Text style={styles.detailVal}>{studentProfile.profile.batchSchedule}</Text></Text>
                      <Text style={styles.detailLabel}>📅 Admission Date: <Text style={styles.detailVal}>{new Date(studentProfile.profile.admissionDate).toLocaleDateString()}</Text></Text>
                      <Text style={styles.detailLabel}>🪙 Monthly Fees: <Text style={styles.detailVal}>₹{studentProfile.profile.monthlyFee}</Text></Text>
                    </Card>
                  </View>

                  {/* Attendance Calendar */}
                  <View style={styles.profileSection}>
                    <View style={styles.calendarHeaderRow}>
                      <TouchableOpacity onPress={() => changeCalendarMonth(-1)} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavText}>‹</Text>
                      </TouchableOpacity>
                      <Text style={styles.sectionHeading}>{formatMonthLabel(calendarMonth)} Attendance</Text>
                      <TouchableOpacity onPress={() => changeCalendarMonth(1)} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavText}>›</Text>
                      </TouchableOpacity>
                    </View>
                    <Card style={styles.detailsSubCard}>
                      <View style={styles.weekDayRow}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <Text key={i} style={styles.weekDayLabel}>{d}</Text>
                        ))}
                      </View>
                      <View style={styles.calendarGrid}>
                        {getCalendarDays().map((cell, idx) => (
                          <View key={idx} style={[styles.calendarCell, cell && getCellStyle(cell.status)]}>
                            {cell ? (
                              <Text style={[styles.calendarCellText, cell.status && styles.calendarCellTextActive]}>
                                {cell.day}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                      <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                          <Text style={styles.legendText}>Present</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
                          <Text style={styles.legendText}>Late</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
                          <Text style={styles.legendText}>Absent</Text>
                        </View>
                      </View>
                      <Text style={styles.calendarOverallText}>
                        Overall: {studentProfile.stats.attendancePercentage}% • Present: {studentProfile.stats.totalPresent} • Late: {studentProfile.stats.totalLate} • Absent: {studentProfile.stats.totalAbsent}
                      </Text>
                    </Card>
                  </View>

                  {/* Fee Record Ledger */}
                  <View style={styles.profileSection}>
                    <Text style={styles.sectionHeading}>Fee Invoices Ledger</Text>
                    {studentProfile.feeSummary && studentProfile.feeSummary.pendingMonthsCount > 0 ? (
                      <View style={styles.feeSummaryBanner}>
                        <Text style={styles.feeSummaryText}>
                          ⚠️ {studentProfile.feeSummary.pendingMonthsCount} month(s) pending — Total Due: ₹{studentProfile.feeSummary.totalPendingAmount}
                        </Text>
                      </View>
                    ) : null}
                    {studentProfile.fees.length === 0 ? (
                      <Text style={styles.emptyLedger}>No monthly billing generated yet.</Text>
                    ) : (
                      studentProfile.fees.map((invoice) => (
                        <View key={invoice._id} style={styles.ledgerRow}>
                          <Text style={styles.ledgerMonth}>🗓️ {invoice.billingMonth}</Text>
                          <View style={styles.ledgerDetails}>
                            <Text style={styles.ledgerAmounts}>Due: ₹{invoice.amountDue} | Paid: ₹{invoice.amountPaid}</Text>
                            <Text style={[styles.ledgerStatus, { color: getStatusColor(invoice.status) }]}>
                              {invoice.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>

                {/* Operations Actions */}
                <View style={styles.profileActions}>
                  <Button
                    title="Deactivate"
                    type="danger"
                    onPress={() => handleDeleteStudent(selectedStudent)}
                    style={styles.profileActionBtn}
                  />
                  <Button
                    title="Edit Info"
                    type="outline"
                    onPress={() => {
                      setDetailModalVisible(false);
                      navigation.navigate('AddEditStudent', { student: selectedStudent });
                    }}
                    style={[styles.profileActionBtn, { marginLeft: 12 }]}
                  />
                  <Button
                    title="Close"
                    type="secondary"
                    onPress={() => setDetailModalVisible(false)}
                    style={[styles.profileActionBtn, { marginLeft: 12 }]}
                  />
                </View>
              </View>
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
  flatList: {
    flexGrow: 1,
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  addIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  addIconText: {
    color: COLORS.primaryLight,
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchFilterContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  searchBar: {
    marginBottom: 10,
  },
  searchBarInput: {
    height: 44,
  },
  batchFilters: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  batchFiltersContent: {
    paddingRight: 24,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: 'transparent',
  },
  filterChipText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  filterChipTextActive: {
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  studentCard: {
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarPlaceholderText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  studentInfo: {
    flex: 1,
  },
  studentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    flex: 1,
  },
  rollBadge: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  studentMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    padding: 20,
    borderTopWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  modalLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoaderText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 12,
  },
  profileWrapper: {
    flex: 1,
  },
  detailTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    marginBottom: 16,
  },
  profileScroll: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  largeAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: 12,
  },
  largeAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  largeAvatarText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  largeName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  largeRoll: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 4,
  },
  profileSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  detailsSubCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 0,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginBottom: 8,
  },
  detailVal: {
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  attendanceStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pctCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  pctNumber: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  pctLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  statsSummary: {
    flex: 1,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavText: {
    color: COLORS.primaryLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekDayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarCellText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  calendarCellTextActive: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  cellPresent: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  cellLate: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
  },
  cellAbsent: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  calendarOverallText: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
  },
  feeSummaryBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  feeSummaryText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyLedger: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontStyle: 'italic',
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ledgerMonth: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  ledgerDetails: {
    alignItems: 'flex-end',
  },
  ledgerAmounts: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  ledgerStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  profileActionBtn: {
    flex: 1,
  },
});

export default StudentListScreen;