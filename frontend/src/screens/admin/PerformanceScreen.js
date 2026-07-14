import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// A student below this average is flagged as needing attention.
const WEAK_THRESHOLD = 40;
const GOOD_THRESHOLD = 60;

const percentColor = (pct) => {
  if (pct === null || pct === undefined) return COLORS.textMuted;
  if (pct >= GOOD_THRESHOLD) return COLORS.success;
  if (pct >= WEAK_THRESHOLD) return COLORS.warning;
  return COLORS.error;
};

const PerformanceScreen = ({ route, navigation }) => {
  const { batchId } = route.params;
  const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState(null);

  // Per-student drill-down
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const fetchReport = async () => {
    try {
      const res = await api.get(`/tests/performance/${batchId}`);
      if (res.data.success) setReport(res.data.data);
    } catch (error) {
      console.error('Error fetching performance', error);
      Alert.alert('Error', 'Performance report load nahi ho paya');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [batchId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReport();
  }, [batchId]);

  const openDetail = async (student) => {
    setDetailVisible(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/tests/student/${student.studentId}`);
      if (res.data.success) setDetail(res.data.data);
    } catch (error) {
      console.error('Error fetching student performance', error);
      Alert.alert('Error', 'Student ka record load nahi ho paya');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderStudent = ({ item }) => {
    const isWeak =
      item.averagePercentage !== null && item.averagePercentage < WEAK_THRESHOLD;

    return (
      <Card
        style={[styles.studentCard, isWeak && styles.studentCardWeak]}
        borderLeftColor={percentColor(item.averagePercentage)}
        onPress={() => openDetail(item)}
      >
        <View style={styles.row}>
          <View style={styles.rankBox}>
            <Text style={styles.rankText}>{item.rank ? `#${item.rank}` : '–'}</Text>
          </View>

          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rollText}>Roll: {item.rollNumber}</Text>

            {item.averagePercentage === null ? (
              <Text style={styles.noDataText}>Abhi koi test nahi diya</Text>
            ) : (
              <View style={styles.subjectSummary}>
                {item.weakestSubject ? (
                  <Text style={styles.weakText}>
                    ⚠️ Weak: {item.weakestSubject.name} ({item.weakestSubject.percentage}%)
                  </Text>
                ) : null}
                {item.bestSubject && item.bestSubject.name !== item.weakestSubject?.name ? (
                  <Text style={styles.strongText}>
                    ⭐ Strong: {item.bestSubject.name} ({item.bestSubject.percentage}%)
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.avgBox}>
            <Text style={[styles.avgValue, { color: percentColor(item.averagePercentage) }]}>
              {item.averagePercentage === null ? '–' : `${item.averagePercentage}%`}
            </Text>
            <Text style={styles.avgLabel}>{item.testsTaken} test{item.testsTaken === 1 ? '' : 's'}</Text>
          </View>
        </View>
      </Card>
    );
  };

  if (loading || !report) {
    return (
      <SafeAreaView style={[styles.safeArea, screenStyle]}>
        <Header title="Performance" showBackButton onBackPress={() => navigation.goBack()} />
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
          title="Performance"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.summaryBar}>
          <Text style={styles.batchName}>{report.batchName}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{report.totalTests}</Text>
              <Text style={styles.statLabel}>Tests</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: percentColor(report.classAverage) }]}>
                {report.classAverage === null ? '–' : `${report.classAverage}%`}
              </Text>
              <Text style={styles.statLabel}>Class Avg</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{report.students.length}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
          </View>

          {report.classSubjects.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Subject-wise (poori class ka average)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {report.classSubjects.map((s) => (
                  <View key={s.name} style={styles.subjectPill}>
                    <Text style={styles.subjectPillName}>{s.name}</Text>
                    <Text style={[styles.subjectPillPct, { color: percentColor(s.percentage) }]}>
                      {s.percentage}%
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>

      <FlatList
        data={report.students}
        keyExtractor={(item) => item.studentId}
        renderItem={renderStudent}
        style={scrollStyle}
        contentContainerStyle={styles.listContainer}
        refreshControl={webRefreshControl(
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Is batch mein koi student nahi hai.</Text>
          </View>
        }
      />

      {/* Per-student drill-down */}
      <Modal
        animationType="slide"
        transparent
        visible={detailVisible}
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {detailLoading || !detail ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>{detail.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {detail.testsTaken} test diye ·{' '}
                  <Text style={{ color: percentColor(detail.averagePercentage) }}>
                    Average {detail.averagePercentage === null ? '–' : `${detail.averagePercentage}%`}
                  </Text>
                </Text>

                <ScrollView style={styles.modalScroll}>
                  {detail.subjects.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>Subject-wise average</Text>
                      {detail.subjects.map((s) => (
                        <View key={s.name} style={styles.subjectBarRow}>
                          <Text style={styles.subjectBarName}>{s.name}</Text>
                          <View style={styles.subjectBarTrack}>
                            <View
                              style={[
                                styles.subjectBarFill,
                                {
                                  width: `${Math.min(s.percentage, 100)}%`,
                                  backgroundColor: percentColor(s.percentage),
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.subjectBarPct, { color: percentColor(s.percentage) }]}>
                            {s.percentage}%
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Test history</Text>
                  {detail.history.length === 0 ? (
                    <Text style={styles.emptyText}>Abhi koi test record nahi.</Text>
                  ) : (
                    detail.history.map((h) => (
                      <View key={h.testId} style={styles.historyRow}>
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyTitle}>{h.title}</Text>
                          <Text style={styles.historyDate}>
                            {new Date(h.testDate).toLocaleDateString()}
                          </Text>
                          {!h.isAbsent && h.marks.length > 0 ? (
                            <Text style={styles.historyMarks}>
                              {h.marks.map((m) => `${m.subject} ${m.marksObtained}/${m.maxMarks}`).join(' · ')}
                            </Text>
                          ) : null}
                        </View>

                        {h.isAbsent ? (
                          <Text style={styles.absentTag}>ABSENT</Text>
                        ) : (
                          <View style={styles.historyScore}>
                            <Text style={[styles.historyPct, { color: percentColor(h.percentage) }]}>
                              {h.percentage}%
                            </Text>
                            <Text style={styles.historyRaw}>
                              {h.totalObtained}/{h.totalMaxMarks}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>

                <Button
                  title="Close"
                  type="secondary"
                  onPress={() => setDetailVisible(false)}
                  style={styles.closeBtn}
                />
              </>
            )}
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
  summaryBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  batchName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 6,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  subjectPill: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 76,
  },
  subjectPillName: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  subjectPillPct: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginTop: 2,
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  studentCard: {
    marginBottom: 10,
  },
  studentCardWeak: {
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBox: {
    width: 42,
    alignItems: 'center',
  },
  rankText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  studentInfo: {
    flex: 1,
    paddingHorizontal: 6,
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  rollText: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  subjectSummary: {
    marginTop: 5,
  },
  weakText: {
    color: COLORS.error,
    fontSize: 11,
  },
  strongText: {
    color: COLORS.success,
    fontSize: 11,
    marginTop: 2,
  },
  noDataText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  avgBox: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  avgValue: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  avgLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
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
    height: '85%',
    padding: 20,
    borderTopWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  modalScroll: {
    flex: 1,
  },
  subjectBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBarName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    width: 100,
  },
  subjectBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  subjectBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  subjectBarPct: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    width: 40,
    textAlign: 'right',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  historyInfo: {
    flex: 1,
    paddingRight: 10,
  },
  historyTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  historyDate: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  historyMarks: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  historyScore: {
    alignItems: 'flex-end',
  },
  historyPct: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  historyRaw: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  absentTag: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: 'bold',
  },
  closeBtn: {
    marginTop: 12,
  },
});

export default PerformanceScreen;
