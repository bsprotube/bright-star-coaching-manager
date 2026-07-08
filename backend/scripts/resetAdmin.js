const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, "../.env") });
const connectDB = require("../config/db");
const User = require("../models/User");

const resetAdminPassword = async () => {
  try {
    await connectDB();
    const admin = await User.findOne({ phone: "9999999999" });
    if (!admin) {
      console.log("❌ Admin user not found.");
      process.exit(1);
    }
    const newPassword = "adminpassword";
    admin.password = newPassword; // plain password — model's pre('save') hook will hash it
    await admin.save();
    console.log("====================================");
    console.log("✅ Admin password reset successful!");
    console.log("Phone    : 9999999999");
    console.log("Password : adminpassword");
    console.log("====================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

resetAdminPassword();