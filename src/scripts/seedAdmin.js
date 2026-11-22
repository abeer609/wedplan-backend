import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/user.js";

// Auth lives on the frontend (Better Auth). This script promotes an
// existing user (signed up via the frontend) to admin. Run it after the
// admin account has signed up once with ADMIN_EMAIL.
async function main() {
  await connectDB(env.MONGODB_URI);
  const user = await User.findOne({ email: env.ADMIN_EMAIL });
  if (!user) {
    console.error(
      `No user found with email ${env.ADMIN_EMAIL}. Sign up via the frontend first, then re-run this script.`
    );
    process.exit(1);
  }
  user.role = "admin";
  user.roleSelected = true;
  user.isBlocked = false;
  user.subscriptionPlan = "premium";
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        role: "admin",
        roleSelected: true,
        isBlocked: false,
        subscriptionPlan: "premium",
      },
    }
  );
  console.log(`Promoted to admin: ${env.ADMIN_EMAIL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
