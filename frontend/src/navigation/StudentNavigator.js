import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../styles/theme';

// Screens
import StudentDashboard from '../screens/student/StudentDashboard';
import AttendanceHistoryScreen from '../screens/student/AttendanceHistoryScreen';
import FeeStatusScreen from '../screens/student/FeeStatusScreen';
import StudentProfileScreen from '../screens/student/StudentProfileScreen';

const Tab = createBottomTabNavigator();

const StudentNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ color, focused }) => {
          let iconGlyph = '•';
          if (route.name === 'Home') iconGlyph = '🏠';
          else if (route.name === 'History') iconGlyph = '📅';
          else if (route.name === 'Fees') iconGlyph = '💳';
          else if (route.name === 'Profile') iconGlyph = '👤';

          return (
            <Text style={[styles.icon, { color, opacity: focused ? 1 : 0.6 }]}>
              {iconGlyph}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={StudentDashboard} />
      <Tab.Screen name="History" component={AttendanceHistoryScreen} />
      <Tab.Screen name="Fees" component={FeeStatusScreen} />
      <Tab.Screen name="Profile" component={StudentProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  icon: {
    fontSize: 20,
    marginBottom: 2,
  },
});

export default StudentNavigator;
