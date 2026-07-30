import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

const AccountSettingsScreen = ({ navigation }) => {
  const { screenStyle, scrollStyle } = useWebScroll();
  const { user, updateUser } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [existingQuestion, setExistingQuestion] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Changing phone or password needs a fresh emailed OTP — email-only changes don't.
  const [otp, setOtp] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const needsOtp = newPhone.trim() !== originalPhone || Boolean(newPassword);

  const fetchMe = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        const me = res.data.user;
        setOriginalPhone(me.phone || '');
        setNewPhone(me.phone || '');
        setOriginalEmail(me.email || '');
        setNewEmail(me.email || '');
        setExistingQuestion(me.securityQuestion || '');
        setSecurityQuestion(me.securityQuestion || '');
      }
    } catch (error) {
      console.error('Error fetching account details', error);
      Alert.alert('Error', 'Could not load account details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const showMessage = (title, msg) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleRequestOtp = async () => {
    setFormError('');
    setErrors({});
    setOtpSentMessage('');

    // request-otp emails whatever is already SAVED in the database, not whatever
    // is currently typed in the email field above — so if this account has no
    // email on file yet, or the one typed here hasn't been saved, save it first
    // (an email-only change needs no OTP of its own) before asking for a code.
    if (!currentPassword) {
      setErrors({ currentPassword: 'Current password is required' });
      setFormError('Please enter your current password in the Confirm section below, then try again');
      return;
    }

    setSendingOtp(true);
    try {
      if (newEmail.trim() && newEmail.trim() !== originalEmail) {
        const saveRes = await api.put('/auth/update-credentials', {
          currentPassword,
          newEmail: newEmail.trim(),
        });
        if (saveRes.data.success) {
          setOriginalEmail(saveRes.data.user.email || '');
        }
      }

      const res = await api.post('/auth/request-otp');
      if (res.data.success) {
        setOtpSentMessage(res.data.message);
      }
    } catch (error) {
      console.error('Request OTP error', error);
      setFormError(error.response?.data?.message || 'Could not send the verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSave = async () => {
    setErrors({});
    setFormError('');

    const newErrors = {};
    if (!currentPassword) newErrors.currentPassword = 'Current password is required';
    if (!newPhone.trim()) newErrors.newPhone = 'Phone number is required';

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) newErrors.newPassword = 'Must be at least 6 characters';
      if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }

    if (needsOtp && !otp.trim()) {
      newErrors.otp = 'A verification code is required to change your phone number or password';
    }

    // Question and answer must travel together, same rule the backend enforces.
    if ((securityQuestion.trim() || securityAnswer.trim()) && (!securityQuestion.trim() || !securityAnswer.trim())) {
      newErrors.securityAnswer = 'Please fill in both the question and the answer';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        currentPassword,
        newPhone: newPhone.trim(),
        newEmail: newEmail.trim(),
      };
      if (newPassword) payload.newPassword = newPassword;
      if (needsOtp) payload.otp = otp.trim();
      if (securityQuestion.trim() && securityAnswer.trim()) {
        payload.securityQuestion = securityQuestion.trim();
        payload.securityAnswer = securityAnswer.trim();
      }

      const res = await api.put('/auth/update-credentials', payload);
      if (res.data.success) {
        await updateUser({ ...user, ...res.data.user });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSecurityAnswer('');
        setOtp('');
        setOtpSentMessage('');
        setOriginalPhone(res.data.user.phone || '');
        setOriginalEmail(res.data.user.email || '');
        setExistingQuestion(res.data.user.securityQuestion || '');
        showMessage('Success', 'Your account details have been updated');
      }
    } catch (error) {
      console.error('Update credentials error', error);
      setFormError(error.response?.data?.message || 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, screenStyle]}>
        <Header title="Account Settings" showBackButton onBackPress={() => navigation.goBack()} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header title="Account Settings" showBackButton onBackPress={() => navigation.goBack()} />
      </View>

      <ScrollView
        style={scrollStyle}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {formError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{formError}</Text>
          </View>
        ) : null}

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Login Details</Text>

          <Input
            label="Phone Number (Username)"
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            error={errors.newPhone}
          />

          <Input
            label="Email (optional)"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />

          <Input
            label="New Password (leave blank to keep current)"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            error={errors.newPassword}
          />

          {newPassword ? (
            <Input
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter the new password"
              secureTextEntry
              error={errors.confirmPassword}
            />
          ) : null}
        </Card>

        {needsOtp ? (
          <Card style={styles.formCard}>
            <Text style={styles.sectionHeading}>Email Verification</Text>
            <Text style={styles.helperText}>
              To change your phone number or password, a verification code will be
              sent to the email address currently on your account.
            </Text>

            <Button
              title={otpSentMessage ? 'Resend Code' : 'Send Verification Code'}
              type="outline"
              onPress={handleRequestOtp}
              loading={sendingOtp}
              style={styles.otpSendBtn}
            />

            {otpSentMessage ? (
              <Text style={styles.otpSentText}>✅ {otpSentMessage}</Text>
            ) : null}

            <Input
              label="Verification Code *"
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code"
              keyboardType="numeric"
              error={errors.otp}
            />
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Forgot Password Recovery</Text>
          <Text style={styles.helperText}>
            This question is asked on the Forgot Password screen. Remember it —
            only you should know the answer.
          </Text>

          {existingQuestion ? (
            <Text style={styles.currentQuestionNote}>
              ✅ Currently set: "{existingQuestion}"
            </Text>
          ) : (
            <Text style={styles.currentQuestionNote}>
              ⚠️ No security question is set yet — Forgot Password will not work
              until you set one.
            </Text>
          )}

          <Input
            label="Security Question"
            value={securityQuestion}
            onChangeText={setSecurityQuestion}
            placeholder="e.g. What was your first student's name?"
          />

          <Input
            label="Answer"
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder={existingQuestion ? 'Type a new answer to change it' : 'Type your answer'}
            error={errors.securityAnswer}
          />
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Confirm</Text>
          <Text style={styles.helperText}>
            For your security, enter your current password before saving any changes.
          </Text>
          <Input
            label="Current Password *"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Your current password"
            secureTextEntry
            error={errors.currentPassword}
          />

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: SPACING.md,
    paddingBottom: 60,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 16,
    paddingVertical: 20,
  },
  sectionHeading: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 12,
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 12,
  },
  currentQuestionNote: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  otpSendBtn: {
    marginBottom: 12,
  },
  otpSentText: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginBottom: 14,
  },
  saveBtn: {
    marginTop: 8,
  },
});

export default AccountSettingsScreen;
