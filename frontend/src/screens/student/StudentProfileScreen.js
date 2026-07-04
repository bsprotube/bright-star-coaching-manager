import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import api, { BASE_URL } from '../../services/api';

const StudentProfileScreen = () => {
  const { user, logout } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/students/${user.id}`);
      if (res.data.success) {
        setProfile(res.data.data.profile);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load profile details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, []);

  const renderProfileDetail = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Profile" />

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
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            {profile?.photoUrl ? (
              <Image
                source={{ uri: `${BASE_URL.replace('/api', '')}${profile.photoUrl}` }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name.substring(0, 2).toUpperCase() : 'BSC'}
                </Text>
              </View>
            )}
            <Text style={styles.studentName}>{profile?.name}</Text>
            <Text style={styles.studentRoll}>Roll Number: {profile?.rollNumber}</Text>
          </View>

          {/* Academic Info */}
          <Text style={styles.sectionHeader}>Academic Assignment</Text>
          <Card style={styles.infoCard}>
            {renderProfileDetail('Assigned Class Batch', profile?.batchName)}
            {renderProfileDetail('Batch Timings', profile?.batchSchedule)}
            {renderProfileDetail('Enrollment Date', profile?.admissionDate ? new Date(profile.admissionDate).toLocaleDateString() : '')}
            {renderProfileDetail('Monthly Fees Rate', `₹${profile?.monthlyFee}`)}
          </Card>

          {/* Contact Details */}
          <Text style={styles.sectionHeader}>Personal Contacts</Text>
          <Card style={styles.infoCard}>
            {renderProfileDetail('Personal Phone', profile?.phone)}
            {renderProfileDetail('Parent/Guardian Phone', profile?.parentPhone)}
            {renderProfileDetail('Contact Email', profile?.email)}
            {renderProfileDetail('Home Address', profile?.address)}
          </Card>

          {/* Logout Action */}
          <Button
            title="Log Out Session"
            type="danger"
            onPress={logout}
            style={styles.logoutBtn}
          />
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
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: 12,
    borderWidth: 2.5,
    borderColor: COLORS.primaryLight,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: 'bold',
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  studentRoll: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 4,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.surfaceLight,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    paddingLeft: 16,
  },
  logoutBtn: {
    marginTop: 32,
  },
});

export default StudentProfileScreen;
