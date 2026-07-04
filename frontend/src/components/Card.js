import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS } from '../styles/theme';

const Card = ({ children, style, onPress, borderLeftColor }) => {
  const CardContainer = onPress ? TouchableOpacity : View;
  
  return (
    <CardContainer
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        borderLeftColor && { borderLeftWidth: 4, borderLeftColor },
        style,
      ]}
    >
      {children}
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.md,
  },
});

export default Card;
