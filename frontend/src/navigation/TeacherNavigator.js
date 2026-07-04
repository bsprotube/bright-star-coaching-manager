import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import ManualAttendanceScreen from '../screens/teacher/ManualAttendanceScreen';
import TeacherReportsScreen from '../screens/teacher/TeacherReportsScreen';
import AddEditStudentScreen from '../screens/admin/AddEditStudentScreen';
import GenerateCodeScreen from '../screens/admin/GenerateCodeScreen';
import AttendanceRegisterScreen from '../screens/admin/AttendanceRegisterScreen';

const Stack = createStackNavigator();

const TeacherNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
      <Stack.Screen name="ManualAttendance" component={ManualAttendanceScreen} />
      <Stack.Screen name="TeacherReports" component={TeacherReportsScreen} />
      <Stack.Screen name="AddEditStudent" component={AddEditStudentScreen} />
      <Stack.Screen name="GenerateCode" component={GenerateCodeScreen} />
      <Stack.Screen name="AttendanceRegister" component={AttendanceRegisterScreen} />
    </Stack.Navigator>
  );
};

export default TeacherNavigator;
