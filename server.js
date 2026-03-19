import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initializeFirebase } from "./config/firebase.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Initialize Firebase Admin SDK
  initializeFirebase();

  // 3. Start Express server
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  });

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ─── Unhandled Rejections ──────────────────────────────────────────────────

  process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
  });

  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err.message);
    process.exit(1);
  });
};

startServer();
