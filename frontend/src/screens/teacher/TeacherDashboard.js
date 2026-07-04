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
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import api from '../../services/api';

const TeacherDashboard = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState([]);

  const fetchTeacherBatches = async () => {
    try {
      const res = await api.get('/batches');
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeacherBatches();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeacherBatches();
  }, []);

  const renderBatchItem = ({ item }) => (
    <Card style={styles.batchCard}>
      <View style={styles.cardHeader}>
        <View style={styles.infoCol}>
          <Text style={styles.batchName}>{item.name}</Text>
          <Text style={styles.scheduleText}>🕒 {item.schedule || 'No schedule set'}</Text>
          <Text style={styles.countText}>👥 Enrollment: {item.studentCount} Students</Text>
        </View>
      </View>
      
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, styles.actionBtnGen]}
          onPress={() => navigation.navigate('GenerateCode', { batch: item })}
        >
          <Text style={styles.actionBtnText}>🔑 Gen Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, styles.actionBtnManual]}
          onPress={() => navigation.navigate('ManualAttendance', { batchId: item._id, batchName: item.name })}
        >
          <Text style={styles.actionBtnText}>✏️ Mark Roll</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, styles.actionBtnReport]}
          onPress={() => navigation.navigate('TeacherReports', { batchId: item._id, batchName: item.name })}
        >
          <Text style={styles.actionBtnText}>📊 Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionBtn, styles.actionBtnReport]}
          onPress={() => navigation.navigate('AttendanceRegister', { batch: item })}
        >
          <Text style={styles.actionBtnText}>📋 Register</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.addStudentBtn}
        onPress={() =>
          navigation.navigate('AddEditStudent', { batchId: item._id, batchName: item.name })
        }
      >
        <Text style={styles.addStudentBtnText}>➕ Add Student to this Batch</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Teacher Panel" />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => item._id}
          renderItem={renderBatchItem}
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome, {user?.name}</Text>
              <Text style={styles.welcomeSubtitle}>Select a batch below to manage daily attendance registers.</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No classes/batches configured in database.</Text>
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
  batchCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primaryLight,
  },
  cardHeader: {
    marginBottom: 12,
  },
  infoCol: {
    width: '100%',
  },
  batchName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  scheduleText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 4,
  },
  countText: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  actionBtnGen: {
    backgroundColor: COLORS.surfaceLight,
  },
  actionBtnManual: {
    backgroundColor: COLORS.primary,
  },
  actionBtnReport: {
    backgroundColor: COLORS.surfaceLight,
  },
  actionBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  addStudentBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addStudentBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
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

export default TeacherDashboard;
