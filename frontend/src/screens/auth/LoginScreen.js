import React, { useState, useContext } from 'react';
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
import { AuthContext } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    let isValid = true;
    setPhoneError('');
    setPasswordError('');
    setGeneralError('');

    if (!phone) {
      setPhoneError('Phone number is required');
      isValid = false;
    } else if (phone.length < 8) {
      setPhoneError('Please enter a valid phone number');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    const result = await login(phone.trim(), password);
    setIsLoading(false);

    if (!result.success) {
      setGeneralError(result.error);
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
              <Text style={styles.logoEmoji}>⭐</Text>
            </View>
            <Text style={styles.title}>Bright Star</Text>
            <Text style={styles.subtitle}>Coaching Manager</Text>
          </View>

          <Card style={styles.loginCard}>
            <Text style={styles.cardHeader}>Welcome Back</Text>
            <Text style={styles.cardSubHeader}>Sign in to your account</Text>

            {generalError ? (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{generalError}</Text>
              </View>
            ) : null}

            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              error={phoneError}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={passwordError}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.loginBtn}
            />
          </Card>

          <Text style={styles.footerNote}>
            Need assistance? Contact your administrator.
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
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.md,
    textAlign: 'center',
    marginTop: 4,
  },
  loginCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  cardHeader: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  cardSubHeader: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginBottom: 24,
    marginTop: 4,
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
  loginBtn: {
    marginTop: 8,
  },
  footerNote: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginTop: 32,
  },
});

export default LoginScreen;
