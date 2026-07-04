import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../styles/theme';

const CodeInput = ({ value, onChangeCode }) => {
  const inputRef1 = useRef(null);
  const inputRef2 = useRef(null);
  
  const [digit1, setDigit1] = useState('');
  const [digit2, setDigit2] = useState('');

  // Sync state values on edit
  useEffect(() => {
    if (value.length === 0) {
      setDigit1('');
      setDigit2('');
    } else {
      setDigit1(value[0] || '');
      setDigit2(value[1] || '');
    }
  }, [value]);

  const handleChangeText1 = (text) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText.length > 0) {
      const val = cleanText[0];
      setDigit1(val);
      onChangeCode(val + digit2);
      // Auto-focus second slot
      inputRef2.current?.focus();
    } else {
      setDigit1('');
      onChangeCode('' + digit2);
    }
  };

  const handleChangeText2 = (text) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText.length > 0) {
      const val = cleanText[0];
      setDigit2(val);
      onChangeCode(digit1 + val);
    } else {
      setDigit2('');
      onChangeCode(digit1 + '');
    }
  };

  const handleKeyPress2 = ({ nativeEvent }) => {
    if (nativeEvent.key === 'Backspace' && digit2.length === 0) {
      // Focus back to slot 1 on backspace
      inputRef1.current?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <TextInput
          ref={inputRef1}
          value={digit1}
          onChangeText={handleChangeText1}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          style={styles.input}
          placeholder="0"
          placeholderTextColor={COLORS.surfaceLight}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.box}>
        <TextInput
          ref={inputRef2}
          value={digit2}
          onChangeText={handleChangeText2}
          onKeyPress={handleKeyPress2}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          style={styles.input}
          placeholder="0"
          placeholderTextColor={COLORS.surfaceLight}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  box: {
    width: 72,
    height: 84,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 2.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.jumbo,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  divider: {
    width: 20,
  },
});

export default CodeInput;
