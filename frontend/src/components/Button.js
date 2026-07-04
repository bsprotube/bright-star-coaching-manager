import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../styles/theme';

const Button = ({
  title,
  onPress,
  type = 'primary', // primary, secondary, outline, danger
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getButtonStyles = () => {
    switch (type) {
      case 'secondary':
        return [styles.btn, styles.btnSecondary];
      case 'outline':
        return [styles.btn, styles.btnOutline];
      case 'danger':
        return [styles.btn, styles.btnDanger];
      case 'primary':
      default:
        return [styles.btn, styles.btnPrimary];
    }
  };

  const getTextStyles = () => {
    switch (type) {
      case 'outline':
        return [styles.text, styles.textOutline];
      case 'secondary':
        return [styles.text, styles.textSecondary];
      case 'primary':
      case 'danger':
      default:
        return [styles.text, styles.textSolid];
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        getButtonStyles(),
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={type === 'outline' ? COLORS.primary : COLORS.text}
        />
      ) : (
        <Text style={[getTextStyles(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnSecondary: {
    backgroundColor: COLORS.surfaceLight,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnDanger: {
    backgroundColor: COLORS.accent,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  textSolid: {
    color: COLORS.text,
  },
  textSecondary: {
    color: COLORS.textMuted,
  },
  textOutline: {
    color: COLORS.primaryLight,
  },
});

export default Button;
