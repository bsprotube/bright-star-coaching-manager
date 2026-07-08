const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Batch = require('../models/Batch');
const StudentDetail = require('../models/StudentDetail');
const FeeRecord = require('../models/FeeRecord');
const { generateDuesUpToDateForStudent } = require('../services/billingService');

const seedData = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log('Clearing existing database collections...');
    await User.deleteMany({});
    await Batch.deleteMany({});
    await StudentDetail.deleteMany({});
    await FeeRecord.deleteMany({});

    console.log('Database cleared.');

    // 1. Create Default Batch
    console.log('Creating default batch...');
    const batch = await Batch.create({
      name: 'ADRE Foundation Batch',
      description: 'Foundation course for Assam Direct Recruitment Examinations',
      schedule: 'Mon-Fri 09:00 AM - 11:30 AM',
      monthlyFeeDefault: 1500,
      classDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    });
    console.log(`Created Batch: ${batch.name}`);

    // 2. Create Default Admin
    console.log('Creating admin user...');
    await User.create({
      name: 'Bright Star Admin',
      phone: '9999999999',
      password: 'adminpassword',
      role: 'admin',
    });

    // 3. Create Default Teacher
    console.log('Creating teacher user...');
    await User.create({
      name: 'Instructor Baruah',
      phone: '8888888888',
      password: 'teacherpassword',
      role: 'teacher',
    });

    // 4. Create Default Student User & Profile details
    console.log('Creating student user...');
    const studentUser = await User.create({
      name: 'Rahul Sarma',
      phone: '7777777777',
      password: 'studentpassword',
      role: 'student',
    });

    await StudentDetail.create({
      userId: studentUser._id,
      rollNumber: 'BSC-2026-001',
      parentPhone: '9876543210',
      address: 'Zoo Road, Guwahati, Assam',
      admissionDate: new Date(),
      monthlyFee: 1500,
      admissionFee: 500, // one-time joining fee — separate from the recurring monthly fee
      batchId: batch._id,
      photoUrl: '',
    });

    // 5. Generate the joining fee (and backfill any elapsed monthly cycles)
    await generateDuesUpToDateForStudent(studentUser._id);

    console.log('----------------------------------------------------');
    console.log('Database Seeding Completed Successfully!');
    console.log('----------------------------------------------------');
    console.log('Default Login Credentials:');
    console.log('1. Admin:   Phone: 9999999999 | Password: adminpassword');
    console.log('2. Teacher: Phone: 8888888888 | Password: teacherpassword');
    console.log('3. Student: Phone: 7777777777 | Password: studentpassword');
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
};

seedData();