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
  TouchableOpacity,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../styles/theme';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// Two ways to prove ownership, because the accounts differ: admins have an email on
// file so they can just receive a code (nothing to remember), while students and
// teachers usually don't and fall back to their security question. Step 1 asks the
// server which of the two this phone number can actually use.
const ForgotPasswordScreen = ({ navigation }) => {
  const { screenStyle, scrollStyle } = useWebScroll();

  const [step, setStep] = useState(1); // 1 = phone, 2 = pick method, 3 = verify + new password
  const [method, setMethod] = useState(null); // 'email' | 'question'

  const [phone, setPhone] = useState('');
  const [options, setOptions] = useState(null);
  const [otp, setOtp] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setErrors({});
    setGeneralError('');
    setInfoMessage('');
  };

  const handleFindOptions = async () => {
    resetMessages();
    if (!phone.trim()) {
      setErrors({ phone: 'Please enter your phone number' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/options', { phone: phone.trim() });
      if (res.data.success) {
        setOptions(res.data);

        // Only one way available? Skip the chooser and go straight to it.
        if (res.data.emailAvailable && !res.data.questionAvailable) {
          await pickEmail(res.data);
        } else if (!res.data.emailAvailable && res.data.questionAvailable) {
          setMethod('question');
          setStep(3);
        } else {
          setStep(2);
        }
      }
    } catch (error) {
      setGeneralError(
        error.response?.data?.message || 'No password recovery is set up for this number'
      );
    } finally {
      setLoading(false);
    }
  };

  const pickEmail = async (opts = options) => {
    resetMessages();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/send-otp', { phone: phone.trim() });
      if (res.data.success) {
        setMethod('email');
        setInfoMessage(res.data.message);
        setStep(3);
      }
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Could not send the verification code');
      // Fall back to the question if that's set up, rather than dead-ending.
      if (opts?.questionAvailable) setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const pickQuestion = () => {
    resetMessages();
    setMethod('question');
    setStep(3);
  };

  const handleResend = async () => {
    await pickEmail();
  };

  const handleReset = async () => {
    resetMessages();
    setSuccessMessage('');

    const newErrors = {};
    if (method === 'email' && !otp.trim()) newErrors.otp = 'Please enter the code sent to your email';
    if (method === 'question' && !answer.trim()) newErrors.answer = 'Please enter your answer';
    if (!newPassword || newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }
    if (confirmPassword !== newPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = { phone: phone.trim(), newPassword };
      if (method === 'email') payload.otp = otp.trim();
      else payload.securityAnswer = answer.trim();

      const res = await api.post('/auth/forgot-password/reset', payload);
      if (res.data.success) {
        setSuccessMessage('Password reset successfully. Please sign in with your new password.');
        setTimeout(() => navigation.navigate('Login'), 1800);
      }
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Could not reset the password');
    } finally {
      setLoading(false);
    }
  };

  const subtitle = () => {
    if (step === 1) return 'Enter your phone number';
    if (step === 2) return 'How would you like to verify?';
    return method === 'email'
      ? 'Enter the 6-digit code sent to your email'
      : 'Answer your security question';
  };

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={scrollStyle}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🔑</Text>
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>{subtitle()}</Text>
          </View>

          <Card style={styles.formCard}>
            {generalError ? (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{generalError}</Text>
              </View>
            ) : null}

            {infoMessage ? (
              <View style={styles.infoAlert}>
                <Text style={styles.infoAlertText}>✅ {infoMessage}</Text>
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
                  onPress={handleFindOptions}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={() => pickEmail()}
                  disabled={loading}
                >
                  <Text style={styles.methodEmoji}>📧</Text>
                  <View style={styles.methodTextWrap}>
                    <Text style={styles.methodTitle}>Email me a code</Text>
                    <Text style={styles.methodDesc}>{options?.maskedEmail}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={pickQuestion}
                  disabled={loading}
                >
                  <Text style={styles.methodEmoji}>❓</Text>
                  <View style={styles.methodTextWrap}>
                    <Text style={styles.methodTitle}>Security question</Text>
                    <Text style={styles.methodDesc} numberOfLines={2}>
                      {options?.question}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {step === 3 ? (
              <>
                {method === 'email' ? (
                  <>
                    <Input
                      label="Verification Code"
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="6-digit code"
                      keyboardType="numeric"
                      error={errors.otp}
                    />
                    <Text style={styles.resendLink} onPress={handleResend}>
                      Resend code
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.questionBox}>
                      <Text style={styles.questionLabel}>Your security question:</Text>
                      <Text style={styles.questionText}>{options?.question}</Text>
                    </View>
                    <Input
                      label="Answer"
                      value={answer}
                      onChangeText={setAnswer}
                      placeholder="Type your answer"
                      error={errors.answer}
                    />
                  </>
                )}

                <Input
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                  error={errors.newPassword}
                />
                <Input
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter the new password"
                  secureTextEntry
                  error={errors.confirmPassword}
                />
                <Button
                  title="Reset Password"
                  onPress={handleReset}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </>
            ) : null}
          </Card>

          <Text style={styles.backLink} onPress={() => navigation.navigate('Login')}>
            ← Back to sign in
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
  infoAlert: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoAlertText: {
    color: COLORS.primaryLight,
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
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodEmoji: {
    fontSize: 26,
    marginRight: 14,
  },
  methodTextWrap: {
    flex: 1,
  },
  methodTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  methodDesc: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 3,
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
  resendLink: {
    color: COLORS.primaryLight,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginTop: -8,
    marginBottom: 16,
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
