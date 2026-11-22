import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { User } from "./models/user.js";

async function sweepExpiredSubscriptions() {
  const result = await User.updateMany(
    {
      subscriptionPlan: "premium",
      subscriptionExpiresAt: { $lte: new Date() },
    },
    { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null } }
  );
  if (result.modifiedCount > 0) {
    console.log(`Downgraded ${result.modifiedCount} expired subscriptions to free`);
  }
}

async function start() {
  await connectDB(env.MONGODB_URI);
  await sweepExpiredSubscriptions();
  setInterval(
    () => sweepExpiredSubscriptions().catch((e) => console.error(e)),
    60 * 60 * 1000
  );
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`wedplan-server listening on ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
