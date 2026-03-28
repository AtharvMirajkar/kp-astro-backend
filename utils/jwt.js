import jwt from "jsonwebtoken";

const JWT_SECRET      = process.env.JWT_SECRET;
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN  || "7d";
const JWT_REFRESH_IN  = process.env.JWT_REFRESH_IN  || "30d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables.");
}

// ── Generate access token ────────────────────────────────────────────────────
export const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// ── Generate refresh token (longer-lived) ────────────────────────────────────
export const generateRefreshToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_IN });

// ── Verify any token ─────────────────────────────────────────────────────────
export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// ── Build the standard token payload from an Admin doc ───────────────────────
export const buildTokenPayload = (admin) => ({
  id:          admin._id.toString(),
  email:       admin.email,
  role:        admin.role,
  permissions: admin.permissions,
});
