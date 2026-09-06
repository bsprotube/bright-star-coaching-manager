import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// The student's "Home" tab is a launcher, not a form: it used to double as the
// check-in screen itself, which meant the roll number, batch, and fee banner
// were always sharing space with a code-entry box whether or not a session was
// even open. Splitting it into a menu (this screen) plus a dedicated
// AttendanceCheckInScreen means Home always shows the same thing — who you are,
// what you owe, and where to go — and check-in gets its own screen that can
// change state (locked / code entry / already checked in) without reflowing
// this one.
const MENU_ITEMS = [
  {
    key: 'attendance',
    title: 'Attendance',
    subtitle: "Check-in for today's class",
    icon: 'checkmark-circle',
    colors: ['#10b981', '#065f46'],
    target: 'AttendanceCheckIn',
  },
  {
    key: 'notes',
    title: 'Notes',
    subtitle: 'Study material & class notes',
    icon: 'book',
    colors: ['#8b5cf6', '#4c1d95'],
    target: 'Notes',
  },
  {
    key: 'history',
    title: 'History',
    subtitle: 'View your attendance history',
    icon: 'time',
    colors: ['#3b82f6', '#1e3a8a'],
    target: 'History',
  },
  {
    key: 'fees',
    title: 'Fees',
    subtitle: 'View fee status and details',
    icon: 'card',
    colors: ['#f59e0b', '#92400e'],
    target: 'Fees',
  },
  {
    key: 'profile',
    title: 'Profile',
    subtitle: 'View and edit your profile',
    icon: 'person',
    colors: ['#06b6d4', '#155e75'],
    target: 'Profile',
  },
  {
    key: 'help',
    title: 'Help & Support',
    subtitle: 'Get help from instructor',
    icon: 'help-circle',
    colors: ['#ec4899', '#831843'],
    target: 'HelpSupport',
  },
];

const StudentHomeMenu = ({ navigation }) => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
  const { user, logout } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentDetails, setStudentDetails] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);

  const loadState = async () => {
    try {
      const profileRes = await api.get(`/students/${user.id}`);
      if (profileRes.data.success) {
        setStudentDetails(profileRes.data.data.profile);
      }

      // Same oldest-unpaid-cycle summary the banner has always shown — the date
      // already missed creates more urgency than the next one coming up.
      const feeRes = await api.get(`/fees/student/${user.id}`);
      if (feeRes.data.success) {
        const unpaid = (feeRes.data.data || []).filter(
          (r) => r.status === 'pending' || r.status === 'partial'
        );
        if (unpaid.length > 0) {
          const totalDue = unpaid.reduce((sum, r) => sum + (r.amountDue - r.amountPaid), 0);
          const oldest = unpaid.reduce((a, b) => (a.billingMonth <= b.billingMonth ? a : b));
          setFeeSummary({
            totalDue,
            monthsPending: unpaid.length,
            oldestDueDate: oldest.dueDate,
          });
        } else {
          setFeeSummary(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadState();
  }, []);

  const renderMenuCard = (item) => (
    <TouchableOpacity
      key={item.key}
      activeOpacity={0.85}
      style={styles.menuCardWrapper}
      onPress={() => navigation.navigate(item.target)}
    >
      <LinearGradient
        colors={item.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.menuCard}
      >
        <Ionicons name={item.icon} size={30} color="rgba(255,255,255,0.95)" />
        <Text style={styles.menuCardTitle}>{item.title}</Text>
        <Text style={styles.menuCardSubtitle}>{item.subtitle}</Text>
        <View style={styles.menuCardArrowBtn}>
          <Ionicons name="chevron-forward" size={16} color={COLORS.text} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      {/* Custom header — this screen's brand moment, distinct enough from the
          rest of the app's plain title bar that it reuses none of <Header/>. */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <View style={styles.logoBox}>
            <Ionicons name="school" size={26} color={COLORS.text} />
          </View>
          <View>
            <Text style={styles.appTitle}>Class Check-In</Text>
            <Text style={styles.appTagline}>Learn  •  Attend  •  Grow</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.accent} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
          {/* Outstanding fees — first thing on the screen, and loud on purpose.
              There's no online payment anywhere in this app, so the banner says
              where to pay rather than offering a button that couldn't do
              anything. */}
          {feeSummary ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.feeBanner}
              onPress={() => navigation.navigate('Fees')}
            >
              <View style={styles.feeBannerTop}>
                <View style={styles.feeBannerIcon}>
                  <Text style={styles.feeBannerIconText}>💰</Text>
                </View>
                <View style={styles.feeBannerTextCol}>
                  <Text style={styles.feeBannerLabel}>FEES DUE</Text>
                  <Text style={styles.feeBannerAmount}>
                    ₹{feeSummary.totalDue.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.feeBannerMeta}>
                    {feeSummary.monthsPending} month
                    {feeSummary.monthsPending > 1 ? 's' : ''} pending
                    {feeSummary.oldestDueDate
                      ? ` · since ${new Date(feeSummary.oldestDueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.feeBannerFooter}>
                <Text style={styles.feeBannerFooterText}>Please pay at the coaching centre</Text>
                <Text style={styles.feeBannerLink}>View Details →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.greetText}>Hello, {user?.name} 👋</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="person" size={16} color={COLORS.primaryLight} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Roll Number</Text>
                <Text style={styles.infoValue}>{studentDetails?.rollNumber || '—'}</Text>
              </View>
            </View>
            <View style={styles.infoBox}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="people" size={16} color={COLORS.primaryLight} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Classroom</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {studentDetails?.batchName || '—'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.menuGrid}>{MENU_ITEMS.map(renderMenuCard)}</View>
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
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  appTagline: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginLeft: 4,
  },
  // Fee banner — unchanged from the original Home screen.
  feeBanner: {
    backgroundColor: COLORS.error + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  feeBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.error + '2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  feeBannerIconText: {
    fontSize: 24,
  },
  feeBannerTextCol: {
    flex: 1,
  },
  feeBannerLabel: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 1.2,
  },
  feeBannerAmount: {
    color: COLORS.error,
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 44,
  },
  feeBannerMeta: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  feeBannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.error + '33',
  },
  feeBannerFooterText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    flex: 1,
  },
  feeBannerLink: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginLeft: 10,
  },
  greetText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  infoBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginTop: 1,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCardWrapper: {
    width: '48.5%',
    marginBottom: 14,
  },
  menuCard: {
    borderRadius: 18,
    padding: 16,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  menuCardTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginTop: 10,
  },
  menuCardSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  menuCardArrowBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StudentHomeMenu;
