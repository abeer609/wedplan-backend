import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { Booking } from "../models/booking.js";
import { Service } from "../models/service.js";
import { Transaction } from "../models/transaction.js";
import { User } from "../models/user.js";

async function main() {
  await connectDB(env.MONGODB_URI);
  await Promise.all([
    Service.syncIndexes(),
    Booking.syncIndexes(),
    Transaction.syncIndexes(),
    User.syncIndexes(),
  ]);
  console.log("Indexes synced for services, bookings, transactions, user");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
