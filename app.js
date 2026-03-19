import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import userBirthDetailRoutes from "./routes/userBirthDetailRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";

const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────

app.use(helmet());                         // Set secure HTTP headers
app.use(cors());                           // Enable CORS (configure origins for production)
app.use(morgan("dev"));                    // HTTP request logger
app.use(express.json({ limit: "10kb" }));  // Parse JSON bodies (with size limit)
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/users", userBirthDetailRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── Error Handlers ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
