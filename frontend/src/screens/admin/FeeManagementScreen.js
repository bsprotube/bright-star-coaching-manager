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
  Image,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api, { BASE_URL } from '../../services/api';

const FeeManagementScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dues, setDues] = useState([]);
  
  // Billing cycle month filter
  const [billingMonth, setBillingMonth] = useState('');
  
  // Payment Modal states
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash'); // cash, upi, card, bank_transfer
  const [transactionId, setTransactionId] = useState('');
  
  const [amountError, setAmountError] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  // Initialize current month YYYY-MM
  useEffect(() => {
    const currentStr = new Date().toISOString().substring(0, 7);
    setBillingMonth(currentStr);
  }, []);

  const fetchDues = async () => {
    if (!billingMonth) return;

    try {
      const res = await api.get(`/fees/dues?month=${billingMonth}`);
      if (res.data.success) {
        setDues(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching fee dues', error);
      Alert.alert('Error', 'Failed to load outstanding dues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [billingMonth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDues();
  }, [billingMonth]);

  const handleOpenPayment = (record) => {
    setSelectedRecord(record);
    const balance = record.amountDue - record.amountPaid;
    setPayAmount(String(balance));
    setPayMethod('cash');
    setTransactionId('');
    setAmountError('');
    setPaymentModalVisible(true);
  };

  const handleRecordPayment = async () => {
    setAmountError('');
    const numAmount = Number(payAmount);
    const balance = selectedRecord.amountDue - selectedRecord.amountPaid;

    if (!payAmount || isNaN(payAmount) || numAmount <= 0) {
      setAmountError('Please enter a valid amount');
      return;
    }

    if (numAmount > balance) {
      setAmountError(`Max allowed payment: ₹${balance}`);
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await api.post('/fees/payment', {
        feeRecordId: selectedRecord.feeRecordId,
        amount: numAmount,
        paymentMethod: payMethod,
        transactionId: transactionId.trim(),
      });

      if (res.data.success) {
        Alert.alert('Success', `Payment of ₹${numAmount} logged successfully`);
        setPaymentModalVisible(false);
        fetchDues();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Payment log failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleTriggerBilling = () => {
    Alert.alert(
      'Trigger Billing Cycle',
      `Run automated invoice generator for month ${billingMonth}? This creates fee records for any newly enrolled or missing students.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute',
          onPress: async () => {
            setBillingLoading(true);
            try {
              const res = await api.post('/fees/trigger-billing', { month: billingMonth });
              if (res.data.success) {
                const s = res.data.data;
                Alert.alert(
                  'Execution Complete',
                  `Billing Cycle generated:\n\nInvoices Created: ${s.invoicesCreated}\nSkipped (Already billing/Inactive): ${s.invoicesSkippedOrExisting}`
                );
                fetchDues();
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', error.response?.data?.message || 'Billing execution failed');
            } finally {
              setBillingLoading(false);
            }
          },
        },
      ]
    );
  };

  const getDuesStatusColor = (status) => {
    if (status === 'partial') return COLORS.warning;
    return COLORS.error; // pending
  };

  const renderDueItem = ({ item }) => {
    const balance = item.amountDue - item.amountPaid;
    return (
      <Card style={styles.dueCard}>
        <View style={styles.cardHeader}>
          {item.photoUrl ? (
            <Image
              source={{ uri: `${BASE_URL.replace('/api', '')}${item.photoUrl}` }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{item.name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.infoCol}>
            <Text style={styles.studentName}>{item.name}</Text>
            <Text style={styles.studentMeta}>Roll: {item.rollNumber} | Batch: {item.batchName}</Text>
            <Text style={styles.dueText}>Remaining Balance: <Text style={styles.feeHighlight}>₹{balance}</Text></Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getDuesStatusColor(item.status) + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: getDuesStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.paidSummary}>Paid: ₹{item.amountPaid} / ₹{item.amountDue}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.payBtn}
            onPress={() => handleOpenPayment(item)}
          >
            <Text style={styles.payBtnText}>Log Payment</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const months = [];
  const currentYear = new Date().getFullYear();
  for (let m = 1; m <= 12; m++) {
    const format = `${currentYear}-${m.toString().padStart(2, '0')}`;
    months.push(format);
  }

  const paymentMethodsList = [
    { id: 'cash', label: '💵 Cash' },
    { id: 'upi', label: '📱 UPI' },
    { id: 'card', label: '💳 Card' },
    { id: 'bank_transfer', label: '🏛️ Bank' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Fee Management"
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            disabled={billingLoading}
            onPress={handleTriggerBilling}
            style={styles.billingIconBtn}
          >
            {billingLoading ? (
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
            ) : (
              <Text style={styles.billingIconText}>⚙️</Text>
            )}
          </TouchableOpacity>
        }
      />

      {/* Month Filter Selector */}
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Billing Month:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
          {months.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.monthChip, billingMonth === m && styles.monthChipActive]}
              onPress={() => setBillingMonth(m)}
            >
              <Text style={[styles.monthChipText, billingMonth === m && styles.monthChipTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={dues}
          keyExtractor={(item) => item.feeRecordId}
          renderItem={renderDueItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Awesome! No outstanding dues for this month.</Text>
            </View>
          }
        />
      )}

      {/* Payment Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {selectedRecord && (
              <>
                <Text style={styles.modalTitle}>Record Fee Transaction</Text>
                
                <Card style={styles.modalSummaryCard}>
                  <Text style={styles.summaryCardLabel}>Student Name: <Text style={styles.summaryCardVal}>{selectedRecord.name}</Text></Text>
                  <Text style={styles.summaryCardLabel}>Billing Cycle: <Text style={styles.summaryCardVal}>{billingMonth}</Text></Text>
                  <Text style={styles.summaryCardLabel}>Balance Dues: <Text style={[styles.summaryCardVal, { color: COLORS.error }]}>₹{selectedRecord.amountDue - selectedRecord.amountPaid}</Text></Text>
                </Card>

                <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
                  <Input
                    label="Transaction Amount (₹) *"
                    value={payAmount}
                    onChangeText={setPayAmount}
                    placeholder="Enter collected amount"
                    keyboardType="numeric"
                    error={amountError}
                  />

                  <Text style={styles.payMethodLabel}>Payment Channel *</Text>
                  <View style={styles.payMethodGrid}>
                    {paymentMethodsList.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.payMethodChip, payMethod === m.id && styles.payMethodChipActive]}
                        onPress={() => setPayMethod(m.id)}
                      >
                        <Text style={[styles.payMethodChipText, payMethod === m.id && styles.payMethodChipTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {payMethod !== 'cash' && (
                    <Input
                      label="Transaction Ref ID / UTR *"
                      value={transactionId}
                      onChangeText={setTransactionId}
                      placeholder="e.g. UPI Ref, Bank UTR"
                    />
                  )}

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      type="secondary"
                      onPress={() => setPaymentModalVisible(false)}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Log Transaction"
                      onPress={handleRecordPayment}
                      loading={submittingPayment}
                      style={[styles.actionBtn, { marginLeft: 12 }]}
                    />
                  </View>
                </ScrollView>
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
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  billingIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  billingIconText: {
    fontSize: 20,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  filterLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginRight: 10,
  },
  monthScroll: {
    flex: 1,
  },
  monthChip: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  monthChipActive: {
    backgroundColor: COLORS.primary,
  },
  monthChipText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
  },
  monthChipTextActive: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  dueCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  studentName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  studentMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  dueText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 6,
    fontWeight: '500',
  },
  feeHighlight: {
    color: COLORS.error,
    fontWeight: 'bold',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
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
  paidSummary: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  payBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  payBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
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
    maxHeight: '90%',
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
  modalSummaryCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.surfaceLight,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  summaryCardLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 4,
  },
  summaryCardVal: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  modalForm: {
    flexGrow: 0,
  },
  payMethodLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  payMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  payMethodChip: {
    width: '48%',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  payMethodChipActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  payMethodChipText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
  },
  payMethodChipTextActive: {
    color: COLORS.primaryLight,
    fontWeight: 'bold',
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

export default FeeManagementScreen;
