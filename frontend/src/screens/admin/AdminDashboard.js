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
import useWebScroll from '../../hooks/useWebScroll';

const AdminDashboard = ({ navigation }) => {
  const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();
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
    // Fetch the two sources independently. They used to share one try/catch, so a
    // single slow/failing call (e.g. /fees/dues timing out while Render's free tier
    // wakes up) threw before setStats ran and every tile fell back to 0 — including
    // students and batches, which had actually loaded fine.
    const [batchResult, duesResult] = await Promise.allSettled([
      api.get('/batches'),
      api.get('/fees/dues'),
    ]);

    let totalStudentsCount = 0;
    let totalBatchesCount = 0;
    let totalOutstandingAmount = 0;
    let totalUnpaidCount = 0;

    if (batchResult.status === 'fulfilled' && batchResult.value.data.success) {
      const batchData = batchResult.value.data;
      totalBatchesCount = batchData.count;
      totalStudentsCount = batchData.data.reduce(
        (acc, b) => acc + (b.studentCount || 0),
        0
      );
    } else {
      console.error('Error fetching batches for dashboard', batchResult.reason);
    }

    if (duesResult.status === 'fulfilled' && duesResult.value.data.success) {
      const duesData = duesResult.value.data;
      totalUnpaidCount = duesData.count;
      totalOutstandingAmount = duesData.data.reduce(
        (acc, f) => acc + (f.amountDue - f.amountPaid),
        0
      );
    } else {
      console.error('Error fetching dues for dashboard', duesResult.reason);
    }

    setStats({
      activeStudents: totalStudentsCount,
      totalBatches: totalBatchesCount,
      outstandingDues: totalOutstandingAmount,
      feeRecordsCount: totalUnpaidCount,
    });

    setLoading(false);
    setRefreshing(false);
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
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header title="Admin Dashboard" />
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
              onPress={() => navigation.navigate('TestList')}
            >
              <Text style={styles.menuEmoji}>📝</Text>
              <Text style={styles.menuText}>Tests, Marks & Performance</Text>
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
