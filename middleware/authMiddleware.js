import { verifyToken } from "../utils/jwt.js";
import Admin from "../models/Admin.js";

// ── Protect: verify JWT and attach admin to req ──────────────────────────────
export const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided. Use: Authorization: Bearer <token>",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const msg =
        err.name === "TokenExpiredError"
          ? "Token has expired. Please log in again."
          : "Invalid token. Please log in again.";
      return res.status(401).json({ success: false, message: msg });
    }

    // 3. Check admin still exists and is active
    const admin = await Admin.findById(decoded.id).select("+isActive");
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "The admin account associated with this token no longer exists.",
      });
    }
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact a superadmin.",
      });
    }

    // 4. Attach to request
    req.admin = admin;
    next();
  } catch (error) {
    console.error("protect middleware error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── Restrict: allow only specific roles ──────────────────────────────────────
export const restrictTo = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.admin.role}`,
      });
    }
    next();
  };

// ── Permission check: verify a specific permission flag ──────────────────────
export const requirePermission = (permission) =>
  (req, res, next) => {
    if (req.admin.role === "superadmin") return next(); // superadmin bypasses all
    if (!req.admin.permissions?.[permission]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permission: "${permission}"`,
      });
    }
    next();
  };
