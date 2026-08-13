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
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import api, { UPLOADS_ORIGIN } from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const StudentProfileScreen = ({ navigation }) => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
  const { user, logout } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  // Sends the photo straight to the server on selection rather than staging it
  // for a later "Save" — this screen has no other editable field, so a separate
  // save step would only be one more tap between picking a photo and it landing.
  const uploadPhoto = async (uri) => {
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        // expo-image-picker returns a blob:/data: URI on web; the RN-style
        // {uri, name, type} object below only resolves to a real file on native.
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('photo', blob, 'profile_photo.jpg');
      } else {
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image';
        formData.append('photo', { uri, name: filename, type });
      }

      const res = await api.put('/students/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setProfile((prev) => ({ ...prev, photoUrl: res.data.data.photoUrl }));
        const msg = 'Your photo has been updated.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Photo saved', msg);
      }
    } catch (error) {
      console.error('Photo upload error', error);
      const msg = error.response?.data?.message || 'Could not upload the photo';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Upload failed', msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSelectFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library access is required to upload a photo');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to take a photo');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const handleChangePhoto = () => {
    // react-native-web's Alert.alert can't show multiple tappable buttons, so on
    // web this goes straight to the file picker instead of offering a choice.
    if (Platform.OS === 'web') {
      handleSelectFromGallery();
      return;
    }
    Alert.alert('Profile Photo', 'Choose a source:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: handleSelectFromGallery },
      { text: 'Take Photo', onPress: handleTakePhoto },
    ]);
  };

  const renderProfileDetail = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header title="My Profile" />
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
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleChangePhoto}
              disabled={uploadingPhoto}
              style={styles.avatarTapTarget}
            >
              {profile?.photoUrl ? (
                <Image
                  source={{ uri: `${UPLOADS_ORIGIN}${profile.photoUrl}` }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {profile?.name ? profile.name.substring(0, 2).toUpperCase() : 'BSC'}
                  </Text>
                </View>
              )}

              {uploadingPhoto ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color={COLORS.text} />
                </View>
              ) : (
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditBadgeText}>📷</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.changePhotoHint}>
              {uploadingPhoto ? 'Uploading…' : '📷 Tap photo to change'}
            </Text>
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

          {/* Forgot Password Setup */}
          <Button
            title="🔑 Forgot Password Setup"
            type="outline"
            onPress={() => navigation.navigate('SecurityQuestion')}
            style={styles.securityBtn}
          />

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
    paddingBottom: 80,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarTapTarget: {
    width: 120,
    height: 120,
    marginBottom: 6,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 2.5,
    borderColor: COLORS.primaryLight,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: 'bold',
  },
  // A camera badge rather than an overlay across the whole photo, so the photo
  // itself — the thing being checked before tapping it — stays fully visible.
  // Sized to read as a button at arm's length on a phone.
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadgeText: {
    fontSize: 18,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoHint: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 10,
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
  securityBtn: {
    marginTop: 32,
  },
  logoutBtn: {
    marginTop: 12,
  },
});

export default StudentProfileScreen;
