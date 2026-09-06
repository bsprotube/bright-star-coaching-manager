import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import useWebScroll from '../../hooks/useWebScroll';

// There's no helpline number stored anywhere in the data model — a phone
// number here would either be hardcoded to one person (wrong the day that
// person changes) or invented. Pointing to the coaching centre in person
// matches the same convention already used on the login screen's footer
// ("Need assistance? Contact your administrator.") instead of promising a
// channel the app doesn't actually have.
const HelpSupportScreen = ({ navigation }) => {
  const { screenStyle, scrollStyle } = useWebScroll();

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header title="Help & Support" showBackButton onBackPress={() => navigation.goBack()} />
      </View>

      <ScrollView style={scrollStyle} contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="help-circle" size={32} color={COLORS.primaryLight} />
          </View>
          <Text style={styles.cardTitle}>Need help with the app?</Text>
          <Text style={styles.cardBody}>
            Speak to your instructor at the coaching centre — they can look up your
            attendance, fees, or account directly and sort most things on the spot.
          </Text>
        </Card>

        <Text style={styles.sectionHeader}>COMMON QUESTIONS</Text>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQ}>Check-in isn't working</Text>
          <Text style={styles.faqA}>
            Make sure you're entering today's code exactly as your teacher shared it —
            codes expire a short while after they're generated. If it still fails, ask
            your teacher to check whether a session is currently open.
          </Text>
        </Card>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQ}>My fees or attendance look wrong</Text>
          <Text style={styles.faqA}>
            Fee payments are recorded by the coaching centre when you pay in person.
            If a payment isn't reflected, or a class you attended shows as absent,
            point it out to your instructor so they can correct it.
          </Text>
        </Card>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQ}>I forgot my password</Text>
          <Text style={styles.faqA}>
            Use "Forgot password?" on the sign-in screen. It only works if a recovery
            question has already been set up on your Profile — if you haven't set one,
            ask your instructor to help you reset your password instead.
          </Text>
        </Card>
      </ScrollView>
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
    paddingBottom: 60,
  },
  card: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
  },
  cardBody: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  faqCard: {
    marginBottom: 12,
  },
  faqQ: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 6,
  },
  faqA: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    lineHeight: 18,
  },
});

export default HelpSupportScreen;
