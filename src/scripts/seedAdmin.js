import mongoose from "mongoose";
import { scrypt, randomBytes } from "node:crypto";
import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/user.js";

const SCRYPT_OPTS = { N: 16384, r: 16, p: 1, dkLen: 64, maxmem: 128 * 16384 * 16 * 2 };

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, SCRYPT_OPTS.dkLen, SCRYPT_OPTS, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

function newId() {
  return new mongoose.Types.ObjectId().toString();
}

// Creates the admin user (with email+password login) if it doesn't exist,
// otherwise promotes/refreshes the existing account:
// sets role=admin, resets the credential password, unblocks.
async function main() {
  await connectDB(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const now = new Date();

  let user = await User.findOne({ email: env.ADMIN_EMAIL });
  if (!user) {
    user = new User({
      _id: newId(),
      name: "Admin",
      email: env.ADMIN_EMAIL,
      emailVerified: true,
      role: "admin",
      roleSelected: true,
      isBlocked: false,
      subscriptionPlan: "premium",
      createdAt: now,
      updatedAt: now,
    });
    await user.save();
    console.log(`Created admin user: ${env.ADMIN_EMAIL}`);
  } else {
    user.role = "admin";
    user.roleSelected = true;
    user.isBlocked = false;
    user.subscriptionPlan = "premium";
    await user.save();
    console.log(`Promoted to admin: ${env.ADMIN_EMAIL}`);
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await db.collection("account").updateOne(
    { providerId: "credential", accountId: String(user._id) },
    {
      $set: {
        password: passwordHash,
        userId: String(user._id),
        providerId: "credential",
        accountId: String(user._id),
        updatedAt: now,
      },
      $setOnInsert: { id: newId(), createdAt: now },
    },
    { upsert: true }
  );
  console.log(`Credential login ready for ${env.ADMIN_EMAIL} (sign in with email + ADMIN_PASSWORD).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
