import React, { useState, useEffect } from 'react';
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
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// Lets a student set (or change) the security question used by the public
// "Forgot Password" screen. Deliberately does NOT touch phone/password/email —
// those go through Account Settings-style flows elsewhere and, for phone/password,
// require an emailed OTP. Most students don't have an email on file, so this stays
// a simple current-password-only confirmation instead of blocking them on that.
const SecurityQuestionScreen = ({ navigation }) => {
  const { screenStyle, headerLayout, scrollStyle } = useWebScroll();

  const [loading, setLoading] = useState(true);
  const [existingQuestion, setExistingQuestion] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMe = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setExistingQuestion(res.data.user.securityQuestion || '');
        setSecurityQuestion(res.data.user.securityQuestion || '');
      }
    } catch (error) {
      console.error('Error fetching account details', error);
      Alert.alert('Error', 'Details load nahi ho paye');
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
    if (!securityQuestion.trim()) newErrors.securityQuestion = 'Question zaroori hai';
    if (!securityAnswer.trim()) newErrors.securityAnswer = 'Answer zaroori hai';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/auth/update-credentials', {
        currentPassword,
        securityQuestion: securityQuestion.trim(),
        securityAnswer: securityAnswer.trim(),
      });
      if (res.data.success) {
        setCurrentPassword('');
        setSecurityAnswer('');
        setExistingQuestion(res.data.user.securityQuestion || '');
        showMessage('Success', 'Recovery question set ho gaya');
      }
    } catch (error) {
      console.error('Update security question error', error);
      setFormError(error.response?.data?.message || 'Save nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, screenStyle]}>
        <Header title="Forgot Password Setup" showBackButton onBackPress={() => navigation.goBack()} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View onLayout={headerLayout}>
        <Header title="Forgot Password Setup" showBackButton onBackPress={() => navigation.goBack()} />
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
          <Text style={styles.helperText}>
            Agar aap kabhi apna password bhool jayein, to Login screen pe "Password
            bhool gaye?" dabakar is question ke jawab se naya password set kar
            sakte hain. Isko yaad rakhein — sirf aap hi jaante ho ye jawab.
          </Text>

          {existingQuestion ? (
            <Text style={styles.currentQuestionNote}>
              ✅ Abhi set hai: "{existingQuestion}"
            </Text>
          ) : (
            <Text style={styles.currentQuestionNote}>
              ⚠️ Abhi koi recovery question set nahi hai — "Forgot Password" kaam
              nahi karega jab tak aap isko set nahi karte.
            </Text>
          )}

          <Input
            label="Security Question"
            value={securityQuestion}
            onChangeText={setSecurityQuestion}
            placeholder="e.g. Aapke pehle school ka naam?"
            error={errors.securityQuestion}
          />

          <Input
            label="Answer"
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder={existingQuestion ? 'Naya answer set karne ke liye likhein' : 'Answer likhein'}
            error={errors.securityAnswer}
          />

          <Input
            label="Current Password *"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Confirm karne ke liye abhi ka password"
            secureTextEntry
            error={errors.currentPassword}
          />

          <Button
            title="Save"
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
    paddingVertical: 20,
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

export default SecurityQuestionScreen;
