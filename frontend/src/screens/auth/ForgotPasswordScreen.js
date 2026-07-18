import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../styles/theme';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api from '../../services/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1 = enter phone, 2 = answer + new password

  const [phone, setPhone] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFindQuestion = async () => {
    setErrors({});
    setGeneralError('');

    if (!phone.trim()) {
      setErrors({ phone: 'Phone number daalein' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/question', { phone: phone.trim() });
      if (res.data.success) {
        setQuestion(res.data.question);
        setStep(2);
      }
    } catch (error) {
      setGeneralError(
        error.response?.data?.message || 'Phone number nahi mila ya recovery question set nahi hai'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrors({});
    setGeneralError('');
    setSuccessMessage('');

    const newErrors = {};
    if (!answer.trim()) newErrors.answer = 'Answer daalein';
    if (!newPassword || newPassword.length < 6) {
      newErrors.newPassword = 'Kam se kam 6 characters ka password';
    }
    if (confirmPassword !== newPassword) {
      newErrors.confirmPassword = 'Password match nahi ho raha';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/reset', {
        phone: phone.trim(),
        securityAnswer: answer.trim(),
        newPassword,
      });
      if (res.data.success) {
        setSuccessMessage('Password reset ho gaya! Ab naye password se login karein.');
        setTimeout(() => navigation.navigate('Login'), 1800);
      }
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Answer galat hai ya kuch gadbad hui');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🔑</Text>
            </View>
            <Text style={styles.title}>Password Bhool Gaye?</Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Apna phone number daalein'
                : 'Security question ka jawab dekar naya password set karein'}
            </Text>
          </View>

          <Card style={styles.formCard}>
            {generalError ? (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{generalError}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successAlert}>
                <Text style={styles.successAlertText}>{successMessage}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Input
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  error={errors.phone}
                />
                <Button
                  title="Continue"
                  onPress={handleFindQuestion}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </>
            ) : (
              <>
                <View style={styles.questionBox}>
                  <Text style={styles.questionLabel}>Aapka Security Question:</Text>
                  <Text style={styles.questionText}>{question}</Text>
                </View>

                <Input
                  label="Answer"
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Jawab likhein"
                  error={errors.answer}
                />
                <Input
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Kam se kam 6 characters"
                  secureTextEntry
                  error={errors.newPassword}
                />
                <Input
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Naya password dobara likhein"
                  secureTextEntry
                  error={errors.confirmPassword}
                />
                <Button
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </>
            )}
          </Card>

          <Text style={styles.backLink} onPress={() => navigation.navigate('Login')}>
            ← Login page par wapas jayein
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  formCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorAlertText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    textAlign: 'center',
  },
  successAlert: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successAlertText: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    textAlign: 'center',
  },
  questionBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  questionLabel: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 4,
  },
  questionText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  actionBtn: {
    marginTop: 8,
  },
  backLink: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});

export default ForgotPasswordScreen;
