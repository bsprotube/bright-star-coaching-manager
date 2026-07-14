import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const MarksEntryScreen = ({ route, navigation }) => {
  const { testId } = route.params;
  const { screenStyle, headerLayout, scrollStyle } = useWebScroll();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(null);

  // Marks are held as strings while editing so a half-typed value never becomes NaN.
  // Shape: { [studentId]: { marks: { [subject]: '18' }, isAbsent: false } }
  const [entries, setEntries] = useState({});

  const fetchTest = async () => {
    try {
      const res = await api.get(`/tests/${testId}`);
      if (res.data.success) {
        const data = res.data.data;
        setTest(data);

        const initial = {};
        for (const row of data.rows) {
          const marks = {};
          for (const m of row.marks) {
            marks[m.subject] = m.marksObtained === null ? '' : String(m.marksObtained);
          }
          initial[row.studentId] = { marks, isAbsent: row.isAbsent };
        }
        setEntries(initial);
      }
    } catch (error) {
      console.error('Error fetching test', error);
      Alert.alert('Error', 'Test load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTest();
  }, [testId]);

  const setMark = (studentId, subject, value) => {
    // Digits only — keeps a stray letter from silently becoming NaN on save.
    const clean = value.replace(/[^0-9]/g, '');
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marks: { ...prev[studentId].marks, [subject]: clean },
      },
    }));
  };

  const toggleAbsent = (studentId) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isAbsent: !prev[studentId].isAbsent,
      },
    }));
  };

  const getTotal = (studentId) => {
    const entry = entries[studentId];
    if (!entry || entry.isAbsent) return null;
    return Object.values(entry.marks).reduce((sum, v) => sum + (Number(v) || 0), 0);
  };

  // Any mark above its subject's max — blocks saving and gets highlighted in red.
  const getOverMaxSubjects = () => {
    if (!test) return [];
    const bad = [];
    for (const row of test.rows) {
      const entry = entries[row.studentId];
      if (!entry || entry.isAbsent) continue;
      for (const sub of test.subjects) {
        const value = entry.marks[sub.name];
        if (value !== '' && Number(value) > sub.maxMarks) {
          bad.push(`${row.name} — ${sub.name} (max ${sub.maxMarks})`);
        }
      }
    }
    return bad;
  };

  const handleSave = async () => {
    const overMax = getOverMaxSubjects();
    if (overMax.length > 0) {
      const msg = `Ye marks max se zyada hain:\n\n${overMax.slice(0, 5).join('\n')}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Marks', msg);
      return;
    }

    const results = test.rows.map((row) => {
      const entry = entries[row.studentId];
      return {
        studentId: row.studentId,
        isAbsent: entry.isAbsent,
        marks: test.subjects
          .filter((sub) => entry.marks[sub.name] !== '')
          .map((sub) => ({
            subject: sub.name,
            marksObtained: Number(entry.marks[sub.name]),
          })),
      };
    });

    setSaving(true);
    try {
      const res = await api.put(`/tests/${testId}/marks`, { results });
      if (res.data.success) {
        const msg = res.data.message;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Saved', msg);
        navigation.goBack();
      }
    } catch (error) {
      console.error('Save marks error', error);
      const msg = error.response?.data?.message || 'Marks save nahi ho paye';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const renderStudent = ({ item }) => {
    const entry = entries[item.studentId];
    if (!entry) return null;

    const total = getTotal(item.studentId);
    const percentage =
      total !== null && test.totalMaxMarks > 0
        ? Math.round((total / test.totalMaxMarks) * 100)
        : null;

    return (
      <Card style={styles.studentCard}>
        <View style={styles.studentHeader}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rollText}>Roll: {item.rollNumber}</Text>
          </View>

          <TouchableOpacity
            style={[styles.absentBtn, entry.isAbsent && styles.absentBtnActive]}
            onPress={() => toggleAbsent(item.studentId)}
          >
            <Text style={[styles.absentBtnText, entry.isAbsent && styles.absentBtnTextActive]}>
              {entry.isAbsent ? '✓ Absent' : 'Absent'}
            </Text>
          </TouchableOpacity>
        </View>

        {entry.isAbsent ? (
          <Text style={styles.absentNote}>
            Absent — ye test average aur ranking mein nahi ginaa jayega.
          </Text>
        ) : (
          <>
            <View style={styles.marksGrid}>
              {test.subjects.map((sub) => {
                const value = entry.marks[sub.name] ?? '';
                const overMax = value !== '' && Number(value) > sub.maxMarks;

                return (
                  <View key={sub.name} style={styles.markCell}>
                    <Text style={styles.markLabel} numberOfLines={1}>
                      {sub.name}
                    </Text>
                    <View style={styles.markInputRow}>
                      <TextInput
                        style={[styles.markInput, overMax && styles.markInputError]}
                        value={value}
                        onChangeText={(v) => setMark(item.studentId, sub.name, v)}
                        placeholder="–"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        maxLength={3}
                      />
                      <Text style={styles.markMax}>/{sub.maxMarks}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Total: <Text style={styles.totalValue}>{total ?? 0}</Text> / {test.totalMaxMarks}
              </Text>
              {percentage !== null ? (
                <Text
                  style={[
                    styles.percentBadge,
                    percentage >= 60
                      ? styles.percentGood
                      : percentage >= 40
                      ? styles.percentMid
                      : styles.percentBad,
                  ]}
                >
                  {percentage}%
                </Text>
              ) : null}
            </View>
          </>
        )}
      </Card>
    );
  };

  if (loading || !test) {
    return (
      <SafeAreaView style={[styles.safeArea, screenStyle]}>
        <Header title="Marks Entry" showBackButton onBackPress={() => navigation.goBack()} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header
          title="Marks Entry"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.testBar}>
          <Text style={styles.testTitle}>{test.title}</Text>
          <Text style={styles.testMeta}>
            {test.batchName} · {new Date(test.testDate).toLocaleDateString()} · Total{' '}
            {test.totalMaxMarks} marks
          </Text>
        </View>
      </View>

      <FlatList
        data={test.rows}
        keyExtractor={(item) => item.studentId}
        renderItem={renderStudent}
        style={scrollStyle}
        contentContainerStyle={styles.listContainer}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Is batch mein koi active student nahi hai.</Text>
          </View>
        }
      />

      <View style={styles.saveBar}>
        <Button
          title={saving ? 'Saving...' : 'Save Marks'}
          onPress={handleSave}
          loading={saving}
          disabled={test.rows.length === 0}
        />
      </View>
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
  testBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  testTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  testMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 3,
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 20,
  },
  studentCard: {
    marginBottom: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  rollText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  absentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  absentBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: COLORS.error,
  },
  absentBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  absentBtnTextActive: {
    color: COLORS.error,
  },
  absentNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
  },
  marksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  markCell: {
    width: '33.33%',
    paddingRight: 8,
    marginBottom: 10,
  },
  markLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 4,
  },
  markInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    borderWidth: 1.5,
    borderColor: 'transparent',
    textAlign: 'center',
  },
  markInputError: {
    borderColor: COLORS.error,
  },
  markMax: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: 10,
  },
  totalLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  totalValue: {
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  percentBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  percentGood: {
    color: COLORS.success,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  percentMid: {
    color: COLORS.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  percentBad: {
    color: COLORS.error,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  saveBar: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    backgroundColor: COLORS.background,
  },
});

export default MarksEntryScreen;
