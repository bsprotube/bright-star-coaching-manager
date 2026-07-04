import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
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

const ReportsScreen = ({ navigation }) => {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Form selections
  const [reportType, setReportType] = useState('daily-attendance'); // daily-attendance, monthly-attendance, fee-due, fee-collection, student-directory
  const [selectedBatch, setSelectedBatch] = useState(null);
  
  // Dynamic filter values
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // In-app "View" (no download) state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewData, setViewData] = useState([]);
  const [viewMeta, setViewMeta] = useState(null);

  useEffect(() => {
    // Default dates on mount
    const today = new Date().toISOString().substring(0, 10);
    const currMonth = new Date().toISOString().substring(0, 7);
    setDate(today);
    setMonth(currMonth);
    setStartDate(today);
    setEndDate(today);

    const fetchBatches = async () => {
      try {
        const res = await api.get('/batches');
        if (res.data.success) {
          setBatches(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedBatch(res.data.data[0]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBatches(false);
      }
    };

    fetchBatches();
  }, []);

  const handleDownload = async (format) => {
    // 1. Validations based on type
    if (['daily-attendance', 'monthly-attendance', 'student-directory'].includes(reportType) && !selectedBatch && reportType !== 'student-directory') {
      Alert.alert('Selection Required', 'Please assign a target batch');
      return;
    }

    setDownloading(true);
    try {
      const token = await getItem('user_token');
      
      // 2. Build URL & query string
      let endpoint = '';
      const queryParams = [`format=${format}`];

      if (reportType === 'daily-attendance') {
        endpoint = '/reports/daily-attendance';
        queryParams.push(`batchId=${selectedBatch._id}`);
        queryParams.push(`date=${date}`);
      } else if (reportType === 'monthly-attendance') {
        endpoint = '/reports/monthly-attendance';
        queryParams.push(`batchId=${selectedBatch._id}`);
        queryParams.push(`month=${month}`);
      } else if (reportType === 'fee-due') {
        endpoint = '/reports/fee-due';
        queryParams.push(`month=${month}`);
      } else if (reportType === 'fee-collection') {
        endpoint = '/reports/fee-collection';
        queryParams.push(`startDate=${startDate}`);
        queryParams.push(`endDate=${endDate}`);
      } else if (reportType === 'student-directory') {
        endpoint = '/reports/students';
        if (selectedBatch) {
          queryParams.push(`batchId=${selectedBatch._id}`);
        }
      }

      const downloadUrl = `${API_URL}${endpoint}?${queryParams.join('&')}`;
      
      // 3. Configure local target uri
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `${reportType}_report_${Date.now()}.${extension}`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      // 4. Run download task
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        localUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 5. Trigger Native Sharing
      if (downloadResult.status === 200) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Success', `Report saved to: ${downloadResult.uri}`);
        }
      } else {
        throw new Error('Server returned non-200 status');
      }
    } catch (error) {
      console.error('Download report error', error);
      Alert.alert('Download Failed', 'Failed to generate or fetch the report. Check server logs.');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewReport = async () => {
    // 1. Same validations as download
    if (['daily-attendance', 'monthly-attendance'].includes(reportType) && !selectedBatch) {
      Alert.alert('Selection Required', 'Please assign a target batch');
      return;
    }

    setViewLoading(true);
    try {
      // 2. Build endpoint & query params (format omitted = backend defaults to JSON)
      let endpoint = '';
      const params = {};

      if (reportType === 'daily-attendance') {
        endpoint = '/reports/daily-attendance';
        params.batchId = selectedBatch._id;
        params.date = date;
      } else if (reportType === 'monthly-attendance') {
        endpoint = '/reports/monthly-attendance';
        params.batchId = selectedBatch._id;
        params.month = month;
      } else if (reportType === 'fee-due') {
        endpoint = '/reports/fee-due';
        params.month = month;
      } else if (reportType === 'fee-collection') {
        endpoint = '/reports/fee-collection';
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (reportType === 'student-directory') {
        endpoint = '/reports/students';
        if (selectedBatch) {
          params.batchId = selectedBatch._id;
        }
      }

      const res = await api.get(endpoint, { params });
      if (res.data.success) {
        setViewData(res.data.data || []);
        setViewMeta({
          date: res.data.date,
          month: res.data.month,
          batch: res.data.batch,
          startDate: res.data.startDate,
          endDate: res.data.endDate,
        });
        setViewModalVisible(true);
      }
    } catch (error) {
      console.error('View report error', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setViewLoading(false);
    }
  };

  const reportTypesList = [
    { id: 'daily-attendance', label: '📅 Daily Attendance Sheet', desc: 'Lists present/absent students on a day' },
    { id: 'monthly-attendance', label: '📊 Monthly Attendance Grid', desc: 'Monthly summary grid percentages' },
    { id: 'fee-due', label: '💸 Unpaid Fees Dues List', desc: 'Unpaid invoicing dues list' },
    { id: 'fee-collection', label: '🪙 Fee Collections Trail', desc: 'Receipt transactions collections history' },
    { id: 'student-directory', label: '🧑‍🎓 Student Contact Register', desc: 'Full active student lists directory' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Reports Center" showBackButton onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Step 1: Report Type */}
        <Text style={styles.sectionTitle}>1. Select Report Type</Text>
        {reportTypesList.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            style={[styles.typeChip, reportType === item.id && styles.typeChipActive]}
            onPress={() => setReportType(item.id)}
          >
            <View>
              <Text style={[styles.typeLabel, reportType === item.id && styles.typeLabelActive]}>
                {item.label}
              </Text>
              <Text style={styles.typeDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.checkIndicator}>{reportType === item.id ? '✓' : ''}</Text>
          </TouchableOpacity>
        ))}

        {/* Step 2: Filters */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>2. Configure Filters</Text>
        <Card style={styles.filtersCard}>
          {/* Batch Selector (conditionally rendered) */}
          {['daily-attendance', 'monthly-attendance', 'student-directory'].includes(reportType) && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Classroom Batch:</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.dropdown}
                onPress={() => setBatchModalVisible(true)}
              >
                <Text style={styles.dropdownValue}>
                  {selectedBatch ? selectedBatch.name : reportType === 'student-directory' ? 'All Batches' : 'Choose Batch'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              {reportType === 'student-directory' && selectedBatch && (
                <TouchableOpacity onPress={() => setSelectedBatch(null)} style={styles.clearBatchBtn}>
                  <Text style={styles.clearBatchText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Date Selector YYYY-MM-DD */}
          {reportType === 'daily-attendance' && (
            <Input
              label="Select Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="e.g. 2026-06-23"
            />
          )}

          {/* Month Selector YYYY-MM */}
          {['monthly-attendance', 'fee-due'].includes(reportType) && (
            <Input
              label="Select Month (YYYY-MM)"
              value={month}
              onChangeText={setMonth}
              placeholder="e.g. 2026-06"
            />
          )}

          {/* Date Range Start/End */}
          {reportType === 'fee-collection' && (
            <View style={styles.dateRangeRow}>
              <View style={styles.dateCol}>
                <Input
                  label="Start Date (YYYY-MM-DD)"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="e.g. 2026-06-01"
                />
              </View>
              <View style={styles.dateColSpacer} />
              <View style={styles.dateCol}>
                <Input
                  label="End Date (YYYY-MM-DD)"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="e.g. 2026-06-30"
                />
              </View>
            </View>
          )}
        </Card>

        {/* Step 3: View or Export */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>3. View or Export</Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.viewBtn}
          onPress={handleViewReport}
          disabled={viewLoading}
        >
          {viewLoading ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.viewBtnText}>👁️ View History (no download)</Text>
          )}
        </TouchableOpacity>

        {downloading ? (
          <View style={styles.downloadLoader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.downloadLoaderText}>Generating documents, please wait...</Text>
          </View>
        ) : (
          <View style={styles.exportActionsRow}>
            <Button
              title="📄 Download PDF"
              type="outline"
              onPress={() => handleDownload('pdf')}
              style={styles.exportBtn}
            />
            <View style={styles.btnSpacer} />
            <Button
              title="📊 Download Excel"
              onPress={() => handleDownload('excel')}
              style={styles.exportBtn}
            />
          </View>
        )}
      </ScrollView>

      {/* Batch selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={batchModalVisible}
        onRequestClose={() => setBatchModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Batch</Text>
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
                      setBatchModalVisible(false);
                    }}
                  >
                    <Text style={styles.batchItemText}>{item.name}</Text>
                    <Text style={styles.batchItemSchedule}>{item.schedule || 'No schedule'}</Text>
                  </TouchableOpacity>
                )}
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
              <Text style={styles.viewModalTitle}>
                {reportTypesList.find(r => r.id === reportType)?.label || 'Report'}
              </Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Text style={styles.viewModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {viewMeta && (
              <Text style={styles.viewModalSubtitle}>
                {[viewMeta.batch, viewMeta.date, viewMeta.month, viewMeta.startDate && `${viewMeta.startDate} to ${viewMeta.endDate}`]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            )}

            {viewData.length === 0 ? (
              <View style={styles.viewEmptyContainer}>
                <Text style={styles.viewEmptyText}>No records found for this selection.</Text>
              </View>
            ) : (
              <ScrollView horizontal>
                <View>
                  {/* Header row: built dynamically from the keys of the first record */}
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
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginBottom: 12,
  },
  typeChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeChipActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  typeLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  typeLabelActive: {
    color: COLORS.primaryLight,
  },
  typeDesc: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 4,
  },
  checkIndicator: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: 'bold',
  },
  filtersCard: {
    paddingVertical: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  dropdown: {
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  dropdownArrow: {
    color: COLORS.textMuted,
    fontSize: 9,
  },
  clearBatchBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  clearBatchText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
  },
  dateRangeRow: {
    flexDirection: 'row',
  },
  dateCol: {
    flex: 1,
  },
  dateColSpacer: {
    width: 16,
  },
  exportActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exportBtn: {
    flex: 1,
  },
  btnSpacer: {
    width: 16,
  },
  downloadLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  downloadLoaderText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 10,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  batchItemText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  batchItemSchedule: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 16,
  },
  viewBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
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
    marginBottom: 4,
  },
  viewModalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    flex: 1,
  },
  viewModalClose: {
    color: COLORS.textMuted,
    fontSize: 18,
    paddingLeft: 12,
  },
  viewModalSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 14,
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

export default ReportsScreen;
