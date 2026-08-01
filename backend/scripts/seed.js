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

// This script WIPES every user, batch, student and fee record before recreating a
// demo set with well-known passwords. That is fine on a dev machine and
// catastrophic anywhere real, so it refuses to run against a production
// environment, and otherwise requires an explicit --confirm flag so it can never
// be triggered by a stray command or an accidental npm script.
const assertSafeToSeed = () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is "production". This script deletes all data.');
    process.exit(1);
  }

  if (!process.argv.includes('--confirm')) {
    // Show only the host, never the full URI — it can carry the database password.
    const target = String(process.env.MONGO_URI || '').replace(/^(mongodb(\+srv)?:\/\/)([^@]*@)?/, '$1');
    console.error('This will DELETE ALL users, batches, students and fee records in:');
    console.error(`  ${target}`);
    console.error('');
    console.error('Re-run with --confirm if that is really what you want:');
    console.error('  node scripts/seed.js --confirm');
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    assertSafeToSeed();

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