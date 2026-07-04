import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../styles/theme';
import { AuthContext } from '../context/AuthContext';

const Header = ({ title, showBackButton = false, onBackPress, rightElement }) => {
  const { logout } = useContext(AuthContext);

  return (
    <View style={styles.header}>
      {showBackButton ? (
        <TouchableOpacity
          onPress={onBackPress}
          activeOpacity={0.7}
          style={styles.btn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {rightElement ? (
        <View style={styles.rightContainer}>{rightElement}</View>
      ) : (
        <TouchableOpacity
          onPress={logout}
          activeOpacity={0.7}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  backText: {
    color: COLORS.primaryLight,
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 60,
  },
  logoutBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});

export default Header;
