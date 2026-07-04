import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api, { BASE_URL } from '../../services/api';

const AddEditStudentScreen = ({ route, navigation }) => {
  const editingStudent = route.params?.student; // Check if editing
  const preselectedBatchId = route.params?.batchId; // Pre-fill batch when added from a batch card
  
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [admissionFee, setAdmissionFee] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [photoUri, setPhotoUri] = useState('');

  // Dropdown Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadBatchesAndProfile = async () => {
      try {
        const res = await api.get('/batches');
        if (res.data.success) {
          setBatches(res.data.data);
          
          // If editing, fill fields using fresh profile pull
          if (editingStudent) {
            const studentRes = await api.get(`/students/${editingStudent.id}`);
            if (studentRes.data.success) {
              const p = studentRes.data.data.profile;
              setName(p.name);
              setPhone(p.phone);
              setEmail(p.email || '');
              setRollNumber(p.rollNumber);
              setParentPhone(p.parentPhone);
              setAddress(p.address);
              setMonthlyFee(String(p.monthlyFee));
              setAdmissionFee(String(p.admissionFee));
              setPhotoUri(p.photoUrl ? `${BASE_URL.replace('/api', '')}${p.photoUrl}` : '');

              const matchBatch = res.data.data.find(b => b._id === p.batchId);
              if (matchBatch) setSelectedBatch(matchBatch);
            }
          } else if (preselectedBatchId) {
            // New student added from a specific batch's "Add Student" button
            const matchBatch = res.data.data.find(b => b._id === preselectedBatchId);
            if (matchBatch) {
              setSelectedBatch(matchBatch);
              setMonthlyFee(String(matchBatch.monthlyFeeDefault));
            }
          }
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load form metadata');
      } finally {
        setLoadingBatches(false);
      }
    };

    loadBatchesAndProfile();
  }, [editingStudent, preselectedBatchId]);

  // Request permissions & open ImagePicker
  const handleSelectPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to snap photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePhotoOptions = () => {
    // react-native-web's Alert.alert doesn't support multiple tappable buttons,
    // so on web we skip straight to the file picker (which opens the laptop's
    // file browser). On native mobile, keep the Gallery/Camera choice menu.
    if (Platform.OS === 'web') {
      handleSelectPhoto();
      return;
    }

    Alert.alert(
      'Profile Picture',
      'Select student photo source:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose from Gallery', onPress: handleSelectPhoto },
        { text: 'Take Photo', onPress: handleTakePhoto },
      ]
    );
  };

  const validate = () => {
    const tempErrors = {};
    let isValid = true;

    if (!name.trim()) tempErrors.name = 'Name is required';
    if (!phone.trim() || phone.length < 8) tempErrors.phone = 'Valid phone number is required';
    if (!editingStudent && (!password || password.length < 6)) {
      tempErrors.password = 'Password must be at least 6 characters';
    }
    if (!rollNumber.trim()) tempErrors.rollNumber = 'Roll number is required';
    if (!parentPhone.trim() || parentPhone.length < 8) tempErrors.parentPhone = 'Parent phone is required';
    if (!address.trim()) tempErrors.address = 'Address is required';
    if (!monthlyFee || isNaN(monthlyFee) || Number(monthlyFee) < 0) {
      tempErrors.monthlyFee = 'Valid monthly fee is required';
    }
    if (!admissionFee || isNaN(admissionFee) || Number(admissionFee) < 0) {
      tempErrors.admissionFee = 'Valid admission fee is required';
    }
    if (!selectedBatch) tempErrors.batch = 'Batch assignment is required';

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setSubmitError('Please correct the highlighted errors');
      Alert.alert('Invalid Form', 'Please correct the highlighted errors');
      return;
    }

    setSubmitError('');
    setSubmitting(true);

    try {
      // Build FormData for multipart upload
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('phone', phone.trim());
      formData.append('email', email.trim());
      if (!editingStudent) {
        formData.append('password', password);
      }
      formData.append('rollNumber', rollNumber.trim().toUpperCase());
      formData.append('parentPhone', parentPhone.trim());
      formData.append('address', address.trim());
      formData.append('monthlyFee', monthlyFee);
      formData.append('admissionFee', admissionFee);
      formData.append('batchId', selectedBatch._id);

      if (photoUri && !photoUri.startsWith('http')) {
        if (Platform.OS === 'web') {
          // On web, expo-image-picker gives back a blob:/data: URI. The RN-style
          // {uri, name, type} object below only works on native (where the bridge
          // resolves it to a real file) — on web it produces an empty/invalid
          // upload, so instead we fetch the blob URI to get a real Blob and
          // append that, which the browser's FormData actually understands.
          const response = await fetch(photoUri);
          const blob = await response.blob();
          formData.append('photo', blob, 'student_photo.jpg');
        } else {
          const filename = photoUri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;

          formData.append('photo', {
            uri: photoUri,
            name: filename,
            type,
          });
        }
      }

      const headers = {
        'Content-Type': 'multipart/form-data',
      };

      if (editingStudent) {
        const res = await api.put(`/students/${editingStudent.id}`, formData, { headers });
        if (res.data.success) {
          setSubmitError('');
          Alert.alert('Success', 'Student updated successfully');
          navigation.goBack();
        }
      } else {
        const res = await api.post('/students', formData, { headers });
        if (res.data.success) {
          setSubmitError('');
          Alert.alert('Success', 'Student registered and first billing invoice generated.');
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Submit student error', error);
      const msg = error.response?.data?.message || 'Error processing registration';
      setSubmitError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={editingStudent ? 'Edit Student Profile' : 'Enroll Student'}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Photo Upload Circle */}
        <View style={styles.photoContainer}>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePhotoOptions} style={styles.photoCircle}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.cameraIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        <Card style={styles.formCard}>
          <Input
            label="Full Name *"
            value={name}
            onChangeText={setName}
            placeholder="Student's name"
            error={errors.name}
          />

          <Input
            label="Mobile Phone *"
            value={phone}
            onChangeText={setPhone}
            placeholder="Student's phone number"
            keyboardType="phone-pad"
            error={errors.phone}
          />

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="Student's email (optional)"
            keyboardType="email-address"
          />

          {!editingStudent && (
            <Input
              label="Login Password *"
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
              secureTextEntry
              error={errors.password}
            />
          )}

          <Input
            label="Roll Number *"
            value={rollNumber}
            onChangeText={setRollNumber}
            placeholder="e.g. BSC-ADRE-042"
            autoCapitalize="characters"
            error={errors.rollNumber}
          />

          <Input
            label="Parent Mobile Phone *"
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholder="Emergency contact"
            keyboardType="phone-pad"
            error={errors.parentPhone}
          />

          <Input
            label="Home Address *"
            value={address}
            onChangeText={setAddress}
            placeholder="City/Village address details"
            multiline
            numberOfLines={2}
            error={errors.address}
          />

          <Input
            label="Monthly Tuition Fee (₹) *"
            value={monthlyFee}
            onChangeText={(text) => {
              setMonthlyFee(text);
              setErrors(prev => ({ ...prev, monthlyFee: null }));
            }}
            placeholder="e.g. 1500"
            keyboardType="numeric"
            error={errors.monthlyFee}
          />

          <Input
            label="Admission Fee (₹) *"
            value={admissionFee}
            onChangeText={(text) => {
              setAdmissionFee(text);
              setErrors(prev => ({ ...prev, admissionFee: null }));
            }}
            placeholder="One-time joining fee, e.g. 500"
            keyboardType="numeric"
            error={errors.admissionFee}
          />

          {/* Batch Dropdown Selector Trigger */}
          <Text style={styles.dropdownLabel}>Assign Batch *</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.dropdown, errors.batch && styles.dropdownError]}
            onPress={() => setBatchModalVisible(true)}
          >
            <Text style={[styles.dropdownValue, !selectedBatch && styles.dropdownPlaceholder]}>
              {selectedBatch ? selectedBatch.name : 'Select classroom batch'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {errors.batch && <Text style={styles.errorText}>{errors.batch}</Text>}

          <Button
            title={editingStudent ? 'Save Profile' : 'Enroll Student'}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>

      {/* Batch Selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={batchModalVisible}
        onRequestClose={() => setBatchModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Batch</Text>
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
                      // Auto populate default fee if empty
                      if (!monthlyFee) {
                        setMonthlyFee(String(item.monthlyFeeDefault));
                      }
                      setErrors(prev => ({ ...prev, batch: null }));
                      setBatchModalVisible(false);
                    }}
                  >
                    <Text style={styles.batchItemText}>{item.name}</Text>
                    <Text style={styles.batchItemFee}>₹{item.monthlyFeeDefault}/mo</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.modalEmptyText}>No active batches config. Create one first.</Text>
                }
              />
            )}
            <Button
              title="Close"
              type="secondary"
              onPress={() => setBatchModalVisible(false)}
              style={styles.modalCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100%',
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    height: '100%',
    overflow: 'scroll',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  container: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  photoPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  formCard: {
    paddingVertical: 24,
  },
  dropdownLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  dropdown: {
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 16,
  },
  dropdownError: {
    borderColor: COLORS.error,
  },
  dropdownValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
  },
  dropdownPlaceholder: {
    color: COLORS.textMuted,
  },
  dropdownArrow: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  submitBtn: {
    marginTop: 16,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  batchItemText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  batchItemFee: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  modalEmptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginVertical: 20,
  },
  modalCloseBtn: {
    marginTop: 16,
  },
});

export default AddEditStudentScreen;