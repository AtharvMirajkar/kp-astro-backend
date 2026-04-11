import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import userBirthDetailRoutes   from "./routes/userBirthDetailRoutes.js";
import notificationRoutes      from "./routes/notificationRoutes.js";
import healthAstrologyRoutes   from "./routes/healthAstrologyRoutes.js";
import dailyHoroscopeRoutes    from "./routes/dailyHoroscopeRoutes.js";
import adminAuthRoutes         from "./routes/adminAuthRoutes.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";

const app = express();

// ─── CORS — allow credentials so HttpOnly cookies are sent cross-origin ────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,           // required for HttpOnly cookies
  methods:     ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

// ─── Security & Utility Middleware ────────────────────────────────────────────

app.use(helmet());
app.use(cookieParser());                          // parse HttpOnly cookies
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

// Public (React Native app)
app.use("/api/users",            userBirthDetailRoutes);
app.use("/api/horoscope",        dailyHoroscopeRoutes);
app.use("/api/health-astrology", healthAstrologyRoutes);

// Admin panel + notifications
app.use("/api/notifications",    notificationRoutes);
app.use("/api/admin/auth",       adminAuthRoutes);

// ─── Error Handlers ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
