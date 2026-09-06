import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../styles/theme';

// Screens
import StudentHomeMenu from '../screens/student/StudentHomeMenu';
import AttendanceCheckInScreen from '../screens/student/AttendanceCheckInScreen';
import HelpSupportScreen from '../screens/student/HelpSupportScreen';
import AttendanceHistoryScreen from '../screens/student/AttendanceHistoryScreen';
import FeeStatusScreen from '../screens/student/FeeStatusScreen';
import StudentProfileScreen from '../screens/student/StudentProfileScreen';
import StudyMaterialsScreen from '../screens/admin/StudyMaterialsScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

// The "Home" tab is a menu (StudentHomeMenu) with two screens it can push on
// top of itself — AttendanceCheckIn and HelpSupport — neither of which needs
// its own tab. Screen names from the menu's other cards (Notes, History, Fees,
// Profile) aren't in this stack at all; React Navigation resolves an unknown
// screen name by bubbling the navigate() call up to the parent Tab.Navigator,
// which is what actually switches to those tabs.
const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="HomeMenu" component={StudentHomeMenu} />
    <HomeStack.Screen name="AttendanceCheckIn" component={AttendanceCheckInScreen} />
    <HomeStack.Screen name="HelpSupport" component={HelpSupportScreen} />
  </HomeStack.Navigator>
);

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
          else if (route.name === 'Notes') iconGlyph = '📚';
          else if (route.name === 'Profile') iconGlyph = '👤';

          return (
            <Text style={[styles.icon, { color, opacity: focused ? 1 : 0.6 }]}>
              {iconGlyph}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="History" component={AttendanceHistoryScreen} />
      <Tab.Screen name="Fees" component={FeeStatusScreen} />
      <Tab.Screen name="Notes" component={StudyMaterialsScreen} />
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
