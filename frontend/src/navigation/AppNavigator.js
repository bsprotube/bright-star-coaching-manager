import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../styles/theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Navigators
import AdminNavigator from './AdminNavigator';
import TeacherNavigator from './TeacherNavigator';
import StudentNavigator from './StudentNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isLoading, userToken, user } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken === null ? (
          // Unauthenticated screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // Authenticated role-based flow
          <>
            {user?.role === 'admin' && (
              <Stack.Screen name="AdminFlow" component={AdminNavigator} />
            )}
            {user?.role === 'teacher' && (
              <Stack.Screen name="TeacherFlow" component={TeacherNavigator} />
            )}
            {user?.role === 'student' && (
              <Stack.Screen name="StudentFlow" component={StudentNavigator} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
