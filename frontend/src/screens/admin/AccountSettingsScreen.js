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
  const { screenStyle, headerLayout, scrollStyle } = useWebScroll();
  const { user, updateUser } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [existingQuestion, setExistingQuestion] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMe = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        const me = res.data.user;
        setNewPhone(me.phone || '');
        setNewEmail(me.email || '');
        setExistingQuestion(me.securityQuestion || '');
        setSecurityQuestion(me.securityQuestion || '');
      }
    } catch (error) {
      console.error('Error fetching account details', error);
      Alert.alert('Error', 'Account details load nahi ho paye');
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

  const handleSave = async () => {
    setErrors({});
    setFormError('');

    const newErrors = {};
    if (!currentPassword) newErrors.currentPassword = 'Current password zaroori hai';
    if (!newPhone.trim()) newErrors.newPhone = 'Phone number zaroori hai';

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) newErrors.newPassword = 'Kam se kam 6 characters';
      if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Password match nahi ho raha';
    }

    // Question and answer must travel together, same rule the backend enforces.
    if ((securityQuestion.trim() || securityAnswer.trim()) && (!securityQuestion.trim() || !securityAnswer.trim())) {
      newErrors.securityAnswer = 'Question aur Answer dono bharein';
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
        setExistingQuestion(res.data.user.securityQuestion || '');
        showMessage('Success', 'Account details update ho gaye');
      }
    } catch (error) {
      console.error('Update credentials error', error);
      setFormError(error.response?.data?.message || 'Update nahi ho paya');
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
      <View onLayout={headerLayout}>
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
            label="New Password (khaali chhodein agar change nahi karna)"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Kam se kam 6 characters"
            secureTextEntry
            error={errors.newPassword}
          />

          {newPassword ? (
            <Input
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Naya password dobara likhein"
              secureTextEntry
              error={errors.confirmPassword}
            />
          ) : null}
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Forgot Password Recovery</Text>
          <Text style={styles.helperText}>
            Ye question "Password bhool gaye?" screen mein pucha jayega. Isko yaad
            rakhein — sirf aap hi jaante ho ye jawab.
          </Text>

          {existingQuestion ? (
            <Text style={styles.currentQuestionNote}>
              ✅ Abhi set hai: "{existingQuestion}"
            </Text>
          ) : (
            <Text style={styles.currentQuestionNote}>
              ⚠️ Abhi koi security question set nahi hai — "Forgot Password" kaam nahi karega
              jab tak aap isko set nahi karte.
            </Text>
          )}

          <Input
            label="Security Question"
            value={securityQuestion}
            onChangeText={setSecurityQuestion}
            placeholder="e.g. Aapke pehle student ka naam?"
          />

          <Input
            label="Answer"
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder={existingQuestion ? 'Naya answer set karne ke liye likhein' : 'Answer likhein'}
            error={errors.securityAnswer}
          />
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Confirm</Text>
          <Text style={styles.helperText}>
            Security ke liye, changes save karne se pehle apna current password daalein.
          </Text>
          <Input
            label="Current Password *"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Abhi ka password"
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
  saveBtn: {
    marginTop: 8,
  },
});

export default AccountSettingsScreen;
