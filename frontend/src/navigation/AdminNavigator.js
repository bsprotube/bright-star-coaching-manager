import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import AdminDashboard from '../screens/admin/AdminDashboard';
import BatchListScreen from '../screens/admin/BatchListScreen';
import StudentListScreen from '../screens/admin/StudentListScreen';
import AddEditStudentScreen from '../screens/admin/AddEditStudentScreen';
import GenerateCodeScreen from '../screens/admin/GenerateCodeScreen';
import FeeManagementScreen from '../screens/admin/FeeManagementScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import AttendanceRegisterScreen from '../screens/admin/AttendanceRegisterScreen';
import ManualAttendanceScreen from '../screens/teacher/ManualAttendanceScreen';

const Stack = createStackNavigator();

const AdminNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="BatchList" component={BatchListScreen} />
      <Stack.Screen name="StudentList" component={StudentListScreen} />
      <Stack.Screen name="AddEditStudent" component={AddEditStudentScreen} />
      <Stack.Screen name="GenerateCode" component={GenerateCodeScreen} />
      <Stack.Screen name="FeeManagement" component={FeeManagementScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="AttendanceRegister" component={AttendanceRegisterScreen} />
      <Stack.Screen name="ManualAttendance" component={ManualAttendanceScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;