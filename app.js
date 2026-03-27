import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import userBirthDetailRoutes   from "./routes/userBirthDetailRoutes.js";
import notificationRoutes      from "./routes/notificationRoutes.js";
import healthAstrologyRoutes   from "./routes/healthAstrologyRoutes.js";
import dailyHoroscopeRoutes    from "./routes/dailyHoroscopeRoutes.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";

const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    success:     true,
    message:     "Server is running",
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/users",            userBirthDetailRoutes);
app.use("/api/notifications",    notificationRoutes);
app.use("/api/health-astrology", healthAstrologyRoutes);
app.use("/api/horoscope",        dailyHoroscopeRoutes);

// ─── Error Handlers ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
