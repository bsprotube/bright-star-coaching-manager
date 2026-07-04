import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import api from '../../services/api';

const AdminDashboard = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeStudents: 0,
    totalBatches: 0,
    outstandingDues: 0,
    feeRecordsCount: 0,
  });

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch batches (to get active students sum and batch count)
      const batchRes = await api.get('/batches');
      let totalStudentsCount = 0;
      let totalBatchesCount = 0;

      if (batchRes.data.success) {
        totalBatchesCount = batchRes.data.count;
        totalStudentsCount = batchRes.data.data.reduce(
          (acc, b) => acc + (b.studentCount || 0),
          0
        );
      }

      // 2. Fetch outstanding dues (pending/partial)
      const duesRes = await api.get('/fees/dues');
      let totalOutstandingAmount = 0;
      let totalUnpaidCount = 0;

      if (duesRes.data.success) {
        totalUnpaidCount = duesRes.data.count;
        totalOutstandingAmount = duesRes.data.data.reduce(
          (acc, f) => acc + (f.amountDue - f.amountPaid),
          0
        );
      }

      setStats({
        activeStudents: totalStudentsCount,
        totalBatches: totalBatchesCount,
        outstandingDues: totalOutstandingAmount,
        feeRecordsCount: totalUnpaidCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  const renderMetricCard = (title, value, subtitle, borderLeftColor, icon) => (
    <Card borderLeftColor={borderLeftColor} style={styles.metricCard}>
      <View style={styles.metricRow}>
        <View>
          <Text style={styles.metricTitle}>{title}</Text>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.metricSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.metricIcon}>{icon}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Admin Dashboard" />

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
          {/* Greeting */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Hello, {user?.name || 'Administrator'}</Text>
            <Text style={styles.welcomeSubtitle}>Bright Star Coaching Institute Operations</Text>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {renderMetricCard(
              'Enrolled Students',
              stats.activeStudents,
              'Active students in list',
              COLORS.primary,
              '👥'
            )}
            {renderMetricCard(
              'Total Batches',
              stats.totalBatches,
              'Active programs running',
              COLORS.info,
              '📚'
            )}
            {renderMetricCard(
              'Unpaid Dues',
              `₹${stats.outstandingDues.toLocaleString()}`,
              `${stats.feeRecordsCount} invoices outstanding`,
              COLORS.error,
              '💸'
            )}
          </View>

          {/* Menu Sections Title */}
          <Text style={styles.sectionTitle}>Management Console</Text>

          {/* Console Grid */}
          <View style={styles.menuGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.menuItem}
              onPress={() => navigation.navigate('BatchList')}
            >
              <Text style={styles.menuEmoji}>🏫</Text>
              <Text style={styles.menuText}>Batches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.menuItem}
              onPress={() => navigation.navigate('StudentList')}
            >
              <Text style={styles.menuEmoji}>🧑‍🎓</Text>
              <Text style={styles.menuText}>Students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.menuItem}
              onPress={() => navigation.navigate('GenerateCode')}
            >
              <Text style={styles.menuEmoji}>🔑</Text>
              <Text style={styles.menuText}>Gen Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.menuItem}
              onPress={() => navigation.navigate('FeeManagement')}
            >
              <Text style={styles.menuEmoji}>🪙</Text>
              <Text style={styles.menuText}>Fees</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.menuItem, styles.menuItemFull]}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={styles.menuEmoji}>📊</Text>
              <Text style={styles.menuText}>Export Reports & Data</Text>
            </TouchableOpacity>
          </View>
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
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  welcomeSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 4,
  },
  metricsGrid: {
    marginBottom: 10,
  },
  metricCard: {
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginVertical: 4,
  },
  metricSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  metricIcon: {
    fontSize: 32,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginVertical: 14,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  menuItemFull: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  menuEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  menuText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginLeft: 8,
  },
});

export default AdminDashboard;
