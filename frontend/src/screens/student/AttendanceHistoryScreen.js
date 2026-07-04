import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import api from '../../services/api';

const AttendanceHistoryScreen = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    percentage: 100,
    present: 0,
    late: 0,
    absent: 0,
  });

  const fetchAttendanceHistory = async () => {
    try {
      const res = await api.get(`/attendance/history/student/${user.id}`);
      if (res.data.success) {
        const records = res.data.data;
        setHistory(records);

        // Compute local stats
        const p = records.filter(r => r.status === 'present').length;
        const l = records.filter(r => r.status === 'late').length;
        const a = records.filter(r => r.status === 'absent').length;
        const total = p + l + a;

        const percentage = total > 0 ? Math.round(((p + l) / total) * 100) : 100;
        
        setStats({ percentage, present: p, late: l, absent: a });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAttendanceHistory();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return COLORS.success;
      case 'late': return COLORS.warning;
      case 'absent':
      default:
        return COLORS.error;
    }
  };

  const renderHistoryItem = ({ item }) => (
    <Card style={styles.historyCard}>
      <View style={styles.historyRow}>
        <View style={styles.leftCol}>
          <Text style={styles.dateText}>🗓️ {item.date}</Text>
          <Text style={styles.timeText}>
            Marked at: {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        <View style={styles.rightCol}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Attendance Logs" />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            <Card style={styles.statsCard}>
              <View style={styles.statsGrid}>
                <View style={styles.chartCol}>
                  <View style={styles.circle}>
                    <Text style={styles.circleText}>{stats.percentage}%</Text>
                    <Text style={styles.circleSubText}>Presence</Text>
                  </View>
                </View>
                
                <View style={styles.summaryCol}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryTitle}>🟢 Present Days</Text>
                    <Text style={styles.summaryVal}>{stats.present} Days</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryTitle}>🟡 Late Days</Text>
                    <Text style={styles.summaryVal}>{stats.late} Days</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryTitle}>🔴 Absent Days</Text>
                    <Text style={styles.summaryVal}>{stats.absent} Days</Text>
                  </View>
                </View>
              </View>
            </Card>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No attendance records recorded yet.</Text>
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
  statsCard: {
    marginBottom: 20,
    backgroundColor: COLORS.surface,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartCol: {
    width: '40%',
    alignItems: 'center',
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: 'bold',
  },
  circleSubText: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  summaryCol: {
    width: '60%',
    paddingLeft: 12,
  },
  summaryItem: {
    marginBottom: 8,
  },
  summaryTitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  summaryVal: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: 'bold',
    marginLeft: 18,
    marginTop: 2,
  },
  historyCard: {
    marginBottom: 10,
    padding: 14,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftCol: {
    flex: 1,
  },
  dateText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    justifyContent: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
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

export default AttendanceHistoryScreen;
