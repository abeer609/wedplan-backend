import mongoose from "mongoose";

let connection;

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  if (!connection) {
    connection = mongoose.connect(uri).then(() => {
      console.log("MongoDB connected");
    });
  }
  return connection;
}

export default connectDB;
