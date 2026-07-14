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
  Platform,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// The subjects this institute actually tests on — one tap adds a section instead of
// typing the name out for every mock test.
const COMMON_SUBJECTS = [
  { name: 'Maths', maxMarks: 25 },
  { name: 'Reasoning', maxMarks: 25 },
  { name: 'GK', maxMarks: 25 },
  { name: 'GS', maxMarks: 25 },
  { name: 'English', maxMarks: 25 },
  { name: 'Current Affairs', maxMarks: 25 },
];

const TestListScreen = ({ navigation }) => {
  const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Create-test modal
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().substring(0, 10));
  const [modalBatchId, setModalBatchId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchBatches = async () => {
    try {
      const res = await api.get('/batches');
      if (res.data.success) setBatches(res.data.data);
    } catch (e) {
      console.error('Error fetching batches', e);
    }
  };

  const fetchTests = async () => {
    try {
      const params = {};
      if (selectedBatchId) params.batchId = selectedBatchId;

      const res = await api.get('/tests', { params });
      if (res.data.success) setTests(res.data.data);
    } catch (error) {
      console.error('Error fetching tests', error);
      Alert.alert('Error', 'Failed to load tests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    fetchTests();
  }, [selectedBatchId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTests();
  }, [selectedBatchId]);

  const openCreateModal = () => {
    setTitle('');
    setTestDate(new Date().toISOString().substring(0, 10));
    setModalBatchId(selectedBatchId || (batches[0] ? batches[0]._id : ''));
    setSubjects([]);
    setFormError('');
    setModalVisible(true);
  };

  const addSubject = (subject) => {
    if (subjects.some((s) => s.name.toLowerCase() === subject.name.toLowerCase())) return;
    setSubjects((prev) => [...prev, { ...subject, maxMarks: String(subject.maxMarks) }]);
  };

  const addCustomSubject = () => {
    setSubjects((prev) => [...prev, { name: '', maxMarks: '25' }]);
  };

  const updateSubject = (index, field, value) => {
    setSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const removeSubject = (index) => {
    setSubjects((prev) => prev.filter((_, i) => i !== index));
  };

  const totalMaxMarks = subjects.reduce((sum, s) => sum + (Number(s.maxMarks) || 0), 0);

  const handleCreate = async () => {
    if (!title.trim()) return setFormError('Test ka naam daalein');
    if (!modalBatchId) return setFormError('Batch select karein');
    if (subjects.length === 0) return setFormError('Kam se kam ek subject add karein');

    const cleaned = subjects.map((s) => ({
      name: s.name.trim(),
      maxMarks: Number(s.maxMarks),
    }));

    if (cleaned.some((s) => !s.name)) return setFormError('Har subject ka naam zaroori hai');
    if (cleaned.some((s) => !Number.isFinite(s.maxMarks) || s.maxMarks < 1)) {
      return setFormError('Har subject ke max marks kam se kam 1 hone chahiye');
    }

    setFormError('');
    setSaving(true);
    try {
      const res = await api.post('/tests', {
        batchId: modalBatchId,
        title: title.trim(),
        testDate,
        subjects: cleaned,
      });
      if (res.data.success) {
        setModalVisible(false);
        fetchTests();
      }
    } catch (error) {
      console.error('Create test error', error);
      setFormError(error.response?.data?.message || 'Test create nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTest = (test) => {
    const message = `"${test.title}" delete karein? Iske saare marks bhi delete ho jayenge.`;

    const doDelete = async () => {
      try {
        const res = await api.delete(`/tests/${test.id}`);
        if (res.data.success) fetchTests();
      } catch (error) {
        console.error('Delete test error', error);
        const msg = error.response?.data?.message || 'Delete nahi ho paya';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Error', msg);
      }
    };

    // react-native-web's Alert.alert can't render multiple tappable buttons, so the
    // destructive option would never be reachable there.
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doDelete();
      return;
    }

    Alert.alert('Delete Test', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const renderTestItem = ({ item }) => (
    <Card
      style={styles.testCard}
      borderLeftColor={item.gradedCount > 0 ? COLORS.success : COLORS.warning}
      onPress={() => navigation.navigate('MarksEntry', { testId: item.id })}
    >
      <View style={styles.testHeaderRow}>
        <Text style={styles.testTitle} numberOfLines={1}>{item.title}</Text>
        <TouchableOpacity onPress={() => handleDeleteTest(item)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.testMeta}>
        📅 {new Date(item.testDate).toLocaleDateString()} · 🏫 {item.batchName}
      </Text>

      <View style={styles.subjectChips}>
        {item.subjects.map((s) => (
          <View key={s.name} style={styles.subjectChip}>
            <Text style={styles.subjectChipText}>{s.name} ({s.maxMarks})</Text>
          </View>
        ))}
      </View>

      <View style={styles.testFooter}>
        <Text style={styles.totalMarksText}>Total: {item.totalMaxMarks} marks</Text>
        <Text
          style={[
            styles.gradedBadge,
            item.gradedCount > 0 ? styles.gradedBadgeDone : styles.gradedBadgePending,
          ]}
        >
          {item.gradedCount > 0 ? `${item.gradedCount} graded` : 'Marks pending'}
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header
          title="Tests & Marks"
          showBackButton
          onBackPress={() => navigation.goBack()}
          rightElement={
            <TouchableOpacity onPress={openCreateModal} style={styles.addIconBtn}>
              <Text style={styles.addIconText}>＋</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                <Text
                  style={[
                    styles.filterChipText,
                    selectedBatchId === b._id && styles.filterChipTextActive,
                  ]}
                >
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedBatchId ? (
            <TouchableOpacity
              style={styles.performanceBtn}
              onPress={() =>
                navigation.navigate('Performance', { batchId: selectedBatchId })
              }
            >
              <Text style={styles.performanceBtnText}>📊 Is batch ka Performance dekho</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hintText}>
              Performance dekhne ke liye upar se ek batch chunein
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(item) => item.id}
          renderItem={renderTestItem}
          style={scrollStyle}
          contentContainerStyle={styles.listContainer}
          refreshControl={webRefreshControl(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Abhi koi test nahi hai.</Text>
              <Text style={styles.emptySubtext}>Upar ＋ dabakar naya test banayein.</Text>
            </View>
          }
        />
      )}

      {/* Create Test Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Naya Test</Text>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              <Input
                label="Test ka naam *"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. ADRE Mock Test 1"
              />

              <Input
                label="Date (YYYY-MM-DD) *"
                value={testDate}
                onChangeText={setTestDate}
                placeholder="2026-07-20"
              />

              <Text style={styles.fieldLabel}>Batch *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalBatchRow}>
                {batches.map((b) => (
                  <TouchableOpacity
                    key={b._id}
                    style={[styles.filterChip, modalBatchId === b._id && styles.filterChipActive]}
                    onPress={() => setModalBatchId(b._id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        modalBatchId === b._id && styles.filterChipTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Subjects *</Text>
              <Text style={styles.fieldHint}>
                Tap karke add karein. Ek subject ka test ho to sirf ek add karein.
              </Text>

              <View style={styles.quickAddRow}>
                {COMMON_SUBJECTS.map((s) => {
                  const added = subjects.some(
                    (x) => x.name.toLowerCase() === s.name.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={s.name}
                      style={[styles.quickChip, added && styles.quickChipAdded]}
                      onPress={() => addSubject(s)}
                      disabled={added}
                    >
                      <Text style={[styles.quickChipText, added && styles.quickChipTextAdded]}>
                        {added ? '✓ ' : '+ '}{s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.quickChip} onPress={addCustomSubject}>
                  <Text style={styles.quickChipText}>+ Custom</Text>
                </TouchableOpacity>
              </View>

              {subjects.map((s, i) => (
                <View key={i} style={styles.subjectRow}>
                  <Input
                    value={s.name}
                    onChangeText={(v) => updateSubject(i, 'name', v)}
                    placeholder="Subject"
                    style={styles.subjectNameInput}
                  />
                  <Input
                    value={s.maxMarks}
                    onChangeText={(v) => updateSubject(i, 'maxMarks', v)}
                    placeholder="Max"
                    keyboardType="numeric"
                    style={styles.subjectMarksInput}
                  />
                  <TouchableOpacity onPress={() => removeSubject(i)} style={styles.removeSubjectBtn}>
                    <Text style={styles.removeSubjectText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {subjects.length > 0 ? (
                <Text style={styles.totalPreview}>Total marks: {totalMaxMarks}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                type="secondary"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Create Test"
                onPress={handleCreate}
                loading={saving}
                style={[styles.modalBtn, { marginLeft: 12 }]}
              />
            </View>
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
  filterContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 8,
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
  performanceBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  performanceBtnText: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  hintText: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  testCard: {
    marginBottom: 12,
  },
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    flex: 1,
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  testMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 4,
  },
  subjectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  subjectChip: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  subjectChipText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  testFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  totalMarksText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  gradedBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  gradedBadgeDone: {
    color: COLORS.success,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  gradedBadgePending: {
    color: COLORS.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 6,
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
    height: '88%',
    padding: 20,
    borderTopWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalForm: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginBottom: 6,
  },
  fieldHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 10,
  },
  modalBatchRow: {
    marginBottom: 16,
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  quickChip: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  quickChipAdded: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  quickChipText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  quickChipTextAdded: {
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectNameInput: {
    flex: 2,
    marginRight: 8,
  },
  subjectMarksInput: {
    flex: 1,
    marginRight: 8,
  },
  removeSubjectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeSubjectText: {
    color: COLORS.error,
    fontWeight: 'bold',
  },
  totalPreview: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginTop: 6,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  modalBtn: {
    flex: 1,
  },
});

export default TestListScreen;
