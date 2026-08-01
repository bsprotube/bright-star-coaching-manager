const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, "../.env") });
const connectDB = require("../config/db");
const User = require("../models/User");

/**
 * Emergency admin password reset, for when nobody can get in and the Forgot
 * Password flow isn't usable (no email and no security question set).
 *
 * The phone and the new password are supplied on the command line. They used to be
 * hardcoded — which meant this script reset the admin to a password published in a
 * public repository, and printed it to the console afterwards.
 *
 *   node scripts/resetAdmin.js <phone> <newPassword>
 */
const resetAdminPassword = async () => {
  const [phone, newPassword] = process.argv.slice(2);

  if (!phone || !newPassword) {
    console.error("Usage: node scripts/resetAdmin.js <phone> <newPassword>");
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error("Refusing to set a password shorter than 8 characters.");
    process.exit(1);
  }

  try {
    await connectDB();

    const admin = await User.findOne({ phone: phone.trim(), role: "admin" });
    if (!admin) {
      console.error(`No admin account found with phone ${phone}.`);
      process.exit(1);
    }

    admin.password = newPassword; // plain — the model's pre('save') hook hashes it
    await admin.save();

    console.log("====================================");
    console.log("Admin password reset successfully.");
    console.log(`Phone: ${admin.phone}`);
    console.log("Password: (the one you just passed in — not printed)");
    console.log("====================================");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

resetAdminPassword();
