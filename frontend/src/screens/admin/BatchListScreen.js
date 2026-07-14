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
  ScrollView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const BatchListScreen = ({ navigation }) => {
  const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState([]);
  
  // Modal visibility & form fields
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null); // null means adding new batch
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [defaultFee, setDefaultFee] = useState('');
  const [classDays, setClassDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  
  const [nameError, setNameError] = useState('');
  const [feeError, setFeeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/batches');
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching batches', error);
      Alert.alert('Error', 'Failed to load batches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBatches();
  }, []);

  const handleOpenAddModal = () => {
    setEditingBatch(null);
    setName('');
    setDescription('');
    setSchedule('');
    setDefaultFee('');
    setClassDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setNameError('');
    setFeeError('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (batch) => {
    setEditingBatch(batch);
    setName(batch.name);
    setDescription(batch.description || '');
    setSchedule(batch.schedule || '');
    setDefaultFee(String(batch.monthlyFeeDefault));
    setClassDays(batch.classDays && batch.classDays.length > 0 ? batch.classDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setNameError('');
    setFeeError('');
    setModalVisible(true);
  };

  const toggleClassDay = (day) => {
    setClassDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const validate = () => {
    let isValid = true;
    setNameError('');
    setFeeError('');

    if (!name.trim()) {
      setNameError('Batch name is required');
      isValid = false;
    }

    if (!defaultFee || isNaN(defaultFee) || Number(defaultFee) < 0) {
      setFeeError('Please enter a valid monthly fee');
      isValid = false;
    }

    if (classDays.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one class day');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        schedule: schedule.trim(),
        monthlyFeeDefault: Number(defaultFee),
        classDays,
      };

      if (editingBatch) {
        // Update batch
        const res = await api.put(`/batches/${editingBatch._id}`, payload);
        if (res.data.success) {
          Alert.alert('Success', 'Batch updated successfully');
          setModalVisible(false);
          fetchBatches();
        }
      } else {
        // Create batch
        const res = await api.post('/batches', payload);
        if (res.data.success) {
          Alert.alert('Success', 'Batch created successfully');
          setModalVisible(false);
          fetchBatches();
        }
      }
    } catch (error) {
      console.error('Submit batch error', error);
      const msg = error.response?.data?.message || 'Failed to save batch details';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (batch) => {
    Alert.alert(
      'Delete Batch',
      `Are you sure you want to delete batch "${batch.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/batches/${batch._id}`);
              if (res.data.success) {
                Alert.alert('Success', 'Batch deleted successfully');
                fetchBatches();
              }
            } catch (error) {
              console.error('Delete batch error', error);
              const msg = error.response?.data?.message || 'Failed to delete batch';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const renderBatchItem = ({ item }) => (
    <Card style={styles.batchCard}>
      <View style={styles.cardHeader}>
        <View style={styles.infoCol}>
          <Text style={styles.batchName}>{item.name}</Text>
          <Text style={styles.scheduleText}>🕒 {item.schedule || 'No schedule set'}</Text>
        </View>
        <View style={styles.headerRightCol}>
          <TouchableOpacity
            style={styles.addStudentIconBtn}
            onPress={() =>
              navigation.navigate('AddEditStudent', { batchId: item._id, batchName: item.name })
            }
          >
            <Text style={styles.addStudentIconText}>＋</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.studentCount} Students</Text>
          </View>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.descText}>{item.description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.feeText}>Default Fee: ₹{item.monthlyFeeDefault}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.markRollBtn}
            onPress={() => navigation.navigate('ManualAttendance', { batchId: item._id, batchName: item.name })}
          >
            <Text style={styles.markRollBtnText}>✏️ Mark Roll</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('AttendanceRegister', { batch: item })}
          >
            <Text style={styles.registerBtnText}>📋 Register</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleOpenEditModal(item)}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header
          title="Manage Batches"
          showBackButton
          onBackPress={() => navigation.goBack()}
          rightElement={
            <TouchableOpacity onPress={handleOpenAddModal} style={styles.addIconBtn}>
              <Text style={styles.addIconText}>＋</Text>
            </TouchableOpacity>
          }
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => item._id}
          renderItem={renderBatchItem}
          style={scrollStyle}
          contentContainerStyle={styles.listContainer}
          refreshControl={webRefreshControl(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No batches configured yet.</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingBatch ? 'Edit Batch Details' : 'Configure New Batch'}
            </Text>
            
            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Input
                label="Batch Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Foundation Batch"
                error={nameError}
              />
              <Input
                label="Schedule / Timings"
                value={schedule}
                onChangeText={setSchedule}
                placeholder="e.g. Mon-Fri 10:00 AM - 12:00 PM"
              />

              <Text style={styles.dayPickerLabel}>Which days does this batch have class?</Text>
              <View style={styles.dayPickerRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, classDays.includes(day) && styles.dayChipActive]}
                    onPress={() => toggleClassDay(day)}
                  >
                    <Text style={[styles.dayChipText, classDays.includes(day) && styles.dayChipTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Brief batch details/syllabus"
                multiline
                numberOfLines={3}
              />
              <Input
                label="Default Monthly Fee (₹)"
                value={defaultFee}
                onChangeText={setDefaultFee}
                placeholder="e.g. 1500"
                keyboardType="numeric"
                error={feeError}
              />
              
              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  type="secondary"
                  onPress={() => setModalVisible(false)}
                  style={styles.actionBtn}
                />
                <Button
                  title={editingBatch ? 'Update' : 'Create'}
                  onPress={handleSubmit}
                  loading={submitting}
                  style={[styles.actionBtn, { marginLeft: 12 }]}
                />
              </View>
            </ScrollView>
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
  batchCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
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
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addStudentIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addStudentIconText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  badge: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.info,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  descText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  feeText: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  actionRow: {
    flexDirection: 'row',
  },
  editBtn: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  registerBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  markRollBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  markRollBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  registerBtnText: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  editBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalForm: {
    flexGrow: 0,
  },
  dayPickerLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  dayPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayChip: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '1.16%',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: COLORS.primaryLight,
  },
  dayChipText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: COLORS.primaryLight,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
  },
});

export default BatchListScreen;