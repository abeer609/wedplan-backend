import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function start() {
  await connectDB(env.MONGODB_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`wedplan-server listening on ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
