import UserBirthDetail from "../models/UserBirthDetail.js";
import { validationResult } from "express-validator";

// ─── Helper ──────────────────────────────────────────────────────────────────

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  return null;
};

// ─── Create or Update (upsert by deviceId) ───────────────────────────────────
// If a record with the same deviceId already exists, update it.
// Otherwise, create a new record.

export const createUserBirthDetail = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { name, gender, deviceId, fcmToken, dateOfBirth, timeOfBirth, placeOfBirth } = req.body;

    // Check if this device already has a record
    const existing = await UserBirthDetail.findOne({ deviceId });

    if (existing) {
      // Device exists → update all fields including the (possibly refreshed) fcmToken
      const updated = await UserBirthDetail.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            name,
            gender,
            fcmToken,
            dateOfBirth,
            timeOfBirth,
            placeOfBirth,
          },
        },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        isNew: false,
        message: "User details updated successfully (existing device)",
        data: updated,
      });
    }

    // New device → create fresh record
    const created = await UserBirthDetail.create({
      name,
      gender,
      deviceId,
      fcmToken,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
    });

    return res.status(201).json({
      success: true,
      isNew: true,
      message: "User birth detail created successfully",
      data: created,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      return res.status(422).json({ success: false, message: "Validation failed", errors });
    }
    // Duplicate key on deviceId (race condition safety net)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A record for this device already exists. Use PUT /:id to update.",
      });
    }
    console.error("createUserBirthDetail error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Read All ────────────────────────────────────────────────────────────────

export const getAllUserBirthDetails = async (req, res) => {
  try {
    const { page = 1, limit = 10, deviceId, gender } = req.query;

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (gender)   filter.gender   = gender.toLowerCase();

    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      UserBirthDetail.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      UserBirthDetail.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getAllUserBirthDetails error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Read One ────────────────────────────────────────────────────────────────

export const getUserBirthDetailById = async (req, res) => {
  try {
    const record = await UserBirthDetail.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    console.error("getUserBirthDetailById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Update FCM Token only (called when RN app refreshes its token) ──────────

export const updateFcmToken = async (req, res) => {
  const { deviceId, fcmToken } = req.body;

  if (!deviceId || !fcmToken) {
    return res.status(422).json({
      success: false,
      message: "Both deviceId and fcmToken are required",
    });
  }

  try {
    const record = await UserBirthDetail.findOneAndUpdate(
      { deviceId },
      { $set: { fcmToken } },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No user found for this deviceId",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FCM token updated successfully",
      data: { deviceId: record.deviceId, fcmToken: record.fcmToken },
    });
  } catch (error) {
    console.error("updateFcmToken error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Update (general) ────────────────────────────────────────────────────────

export const updateUserBirthDetail = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const record = await UserBirthDetail.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User birth detail updated successfully",
      data: record,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      return res.status(422).json({ success: false, message: "Validation failed", errors });
    }
    console.error("updateUserBirthDetail error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Delete ──────────────────────────────────────────────────────────────────

export const deleteUserBirthDetail = async (req, res) => {
  try {
    const record = await UserBirthDetail.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User birth detail deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    console.error("deleteUserBirthDetail error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
