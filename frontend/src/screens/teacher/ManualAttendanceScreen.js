import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import api, { BASE_URL } from '../../services/api';

const ManualAttendanceScreen = ({ route, navigation }) => {
  const { batchId, batchName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [date, setDate] = useState('');
  const [students, setStudents] = useState([]);
  const [submittingId, setSubmittingId] = useState(null); // track which student is updating

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
              <Text style={styles.pendingFeeText}>
                💸 ₹{item.pendingFeeAmount} due ({item.pendingFeeMonths} month{item.pendingFeeMonths > 1 ? 's' : ''})
              </Text>
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
    <SafeAreaView style={styles.safeArea}>
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

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.studentId}
          renderItem={renderStudentRow}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No students enrolled in this batch.</Text>
            </View>
          }
        />
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
