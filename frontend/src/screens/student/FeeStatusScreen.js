import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import api from '../../services/api';

const FeeStatusScreen = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState([]);
  
  // Track which invoice card is expanded
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const fetchFees = async () => {
    try {
      const res = await api.get(`/fees/student/${user.id}`);
      if (res.data.success) {
        setInvoices(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedInvoiceId(null);
    fetchFees();
  }, []);

  const toggleExpand = (id) => {
    if (expandedInvoiceId === id) {
      setExpandedInvoiceId(null);
    } else {
      setExpandedInvoiceId(id);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'paid': return COLORS.success;
      case 'partial': return COLORS.warning;
      case 'pending':
      default:
        return COLORS.error;
    }
  };

  const renderInvoiceItem = ({ item }) => {
    const isExpanded = expandedInvoiceId === item._id;
    const balance = item.amountDue - item.amountPaid;

    return (
      <Card
        borderLeftColor={getStatusColor(item.status)}
        style={styles.invoiceCard}
        onPress={() => toggleExpand(item._id)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.monthText}>🗓️ Billing Month: {item.billingMonth}</Text>
            <Text style={styles.dueText}>Due Date: {new Date(item.dueDate).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardSummary}>
          <Text style={styles.summaryText}>Fee Amount: <Text style={styles.boldText}>₹{item.amountDue}</Text></Text>
          <Text style={styles.summaryText}>Paid: <Text style={styles.boldText}>₹{item.amountPaid}</Text></Text>
          {balance > 0 ? (
            <Text style={styles.summaryText}>Balance: <Text style={[styles.boldText, { color: COLORS.error }]}>₹{balance}</Text></Text>
          ) : (
            <Text style={[styles.summaryText, { color: COLORS.success, fontWeight: 'bold' }]}>No Dues</Text>
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.transactionsHeading}>Receipt Logs</Text>
            
            {item.payments.length === 0 ? (
              <Text style={styles.emptyTransactions}>No transaction history logged for this invoice.</Text>
            ) : (
              item.payments.map((p, idx) => (
                <View key={p._id || idx} style={styles.transactionRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txDate}>📅 {new Date(p.paymentDate).toLocaleDateString()}</Text>
                    <Text style={styles.txId}>Ref: {p.transactionId || 'CASH/DIRECT'}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txAmount}>₹{p.amount}</Text>
                    <Text style={styles.txMethod}>{p.paymentMethod.toUpperCase()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        
        <Text style={styles.tapToExpandText}>
          {isExpanded ? '▲ Tap to collapse details' : '▼ Tap to expand transaction receipts'}
        </Text>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Invoices" />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item._id}
          renderItem={renderInvoiceItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No monthly invoice sheets generated for your profile.</Text>
            </View>
          }
        />
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
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  invoiceCard: {
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
    paddingBottom: 10,
  },
  monthText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  dueText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
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
  cardSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  summaryText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  boldText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  transactionsHeading: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  emptyTransactions: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  txLeft: {
    flex: 1,
  },
  txDate: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
  },
  txId: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: 'bold',
  },
  txMethod: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  tapToExpandText: {
    color: COLORS.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
  },
});

export default FeeStatusScreen;
