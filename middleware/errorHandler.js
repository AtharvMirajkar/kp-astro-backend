// ─── 404 Handler ─────────────────────────────────────────────────────────────

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${err.message}`);

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(isDev && { stack: err.stack }),
  });
};
