import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getItem } from '../../utils/storage';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api, { API_URL } from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const TeacherReportsScreen = ({ route, navigation }) => {
  const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();
  const { batchId, batchName } = route.params;

  const [reportType, setReportType] = useState('daily-attendance'); // daily-attendance, monthly-attendance
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [downloading, setDownloading] = useState(false);

  // In-app "View" (no download) state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewData, setViewData] = useState([]);

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10);
    const currMonth = new Date().toISOString().substring(0, 7);
    setDate(today);
    setMonth(currMonth);
  }, []);

  const handleViewReport = async () => {
    setViewLoading(true);
    try {
      const params = { batchId };
      let endpoint = '';

      if (reportType === 'daily-attendance') {
        endpoint = '/reports/daily-attendance';
        params.date = date;
      } else if (reportType === 'monthly-attendance') {
        endpoint = '/reports/monthly-attendance';
        params.month = month;
      }

      const res = await api.get(endpoint, { params });
      if (res.data.success) {
        setViewData(res.data.data || []);
        setViewModalVisible(true);
      }
    } catch (error) {
      console.error('View report error', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      const token = await getItem('user_token');
      
      let endpoint = '';
      const queryParams = [`format=${format}`, `batchId=${batchId}`];

      if (reportType === 'daily-attendance') {
        endpoint = '/reports/daily-attendance';
        queryParams.push(`date=${date}`);
      } else if (reportType === 'monthly-attendance') {
        endpoint = '/reports/monthly-attendance';
        queryParams.push(`month=${month}`);
      }

      const downloadUrl = `${API_URL}${endpoint}?${queryParams.join('&')}`;
      
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `${reportType}_${batchName.replace(/\s+/g, '_')}_report.${extension}`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        localUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status === 200) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Saved', `Saved to ${downloadResult.uri}`);
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header
          title={`Reports: ${batchName}`}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
      </View>

      <ScrollView
        style={scrollStyle}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Type */}
        <Text style={styles.label}>1. Select Report Option</Text>
        
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.optionCard, reportType === 'daily-attendance' && styles.optionActive]}
          onPress={() => setReportType('daily-attendance')}
        >
          <Text style={[styles.optionText, reportType === 'daily-attendance' && styles.optionTextActive]}>
            📅 Daily Attendance Report
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.optionCard, reportType === 'monthly-attendance' && styles.optionActive]}
          onPress={() => setReportType('monthly-attendance')}
        >
          <Text style={[styles.optionText, reportType === 'monthly-attendance' && styles.optionTextActive]}>
            📊 Monthly Attendance Summary
          </Text>
        </TouchableOpacity>

        {/* Step 2: Filters */}
        <Text style={[styles.label, { marginTop: 20 }]}>2. Specify Filters</Text>
        <Card style={styles.filtersCard}>
          {reportType === 'daily-attendance' ? (
            <Input
              label="Select Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="e.g. 2026-06-23"
            />
          ) : (
            <Input
              label="Select Month (YYYY-MM)"
              value={month}
              onChangeText={setMonth}
              placeholder="e.g. 2026-06"
            />
          )}
        </Card>

        {/* Step 3: View or Export */}
        <Text style={[styles.label, { marginTop: 20 }]}>3. View or Export</Text>

        <Button
          title={viewLoading ? '...' : '👁️ View History (no download)'}
          onPress={handleViewReport}
          disabled={viewLoading}
          style={{ marginBottom: 12 }}
        />
        
        {downloading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Generating document...</Text>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <Button
              title="Download PDF"
              type="outline"
              onPress={() => handleDownload('pdf')}
              style={styles.actionBtn}
            />
            <View style={styles.spacer} />
            <Button
              title="Download Excel"
              onPress={() => handleDownload('excel')}
              style={styles.actionBtn}
            />
          </View>
        )}
      </ScrollView>

      {/* In-app View (no download) Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={viewModalVisible}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.viewModalBg}>
          <View style={styles.viewModalContent}>
            <View style={styles.viewModalHeader}>
              <Text style={styles.viewModalTitle}>Report History</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Text style={styles.viewModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {viewData.length === 0 ? (
              <View style={styles.viewEmptyContainer}>
                <Text style={styles.viewEmptyText}>No records found for this selection.</Text>
              </View>
            ) : (
              <ScrollView horizontal>
                <View>
                  <View style={styles.viewTableHeaderRow}>
                    {Object.keys(viewData[0]).map((key) => (
                      <View key={key} style={styles.viewTableHeadCell}>
                        <Text style={styles.viewTableHeadText}>{key}</Text>
                      </View>
                    ))}
                  </View>
                  <ScrollView style={styles.viewTableBody}>
                    {viewData.map((row, rIdx) => (
                      <View
                        key={rIdx}
                        style={[styles.viewTableRow, rIdx % 2 === 1 && styles.viewTableRowAlt]}
                      >
                        {Object.keys(viewData[0]).map((key) => (
                          <View key={key} style={styles.viewTableCell}>
                            <Text style={styles.viewTableCellText}>{String(row[key])}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>
            )}

            <Button
              title="Close"
              type="secondary"
              onPress={() => setViewModalVisible(false)}
              style={{ marginTop: 16 }}
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
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
  },
  label: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginBottom: 10,
  },
  optionCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceLight,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  optionText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '500',
  },
  optionTextActive: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  filtersCard: {
    paddingVertical: 16,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
  },
  spacer: {
    width: 16,
  },
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loaderText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 8,
  },
  viewModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  viewModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '50%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  viewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewModalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  viewModalClose: {
    color: COLORS.textMuted,
    fontSize: 18,
    paddingLeft: 12,
  },
  viewEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  viewEmptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  viewTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  viewTableHeadCell: {
    minWidth: 110,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
  },
  viewTableHeadText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  viewTableBody: {
    maxHeight: 400,
  },
  viewTableRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
  },
  viewTableRowAlt: {
    backgroundColor: COLORS.surface,
  },
  viewTableCell: {
    minWidth: 110,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
    justifyContent: 'center',
  },
  viewTableCellText: {
    color: COLORS.text,
    fontSize: 11,
  },
});

export default TeacherReportsScreen;
