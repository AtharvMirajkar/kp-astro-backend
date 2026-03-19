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

// ─── Create ──────────────────────────────────────────────────────────────────

export const createUserBirthDetail = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { name, gender, deviceId, dateOfBirth, timeOfBirth, placeOfBirth } = req.body;

    const userBirthDetail = await UserBirthDetail.create({
      name,
      gender,
      deviceId,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
    });

    return res.status(201).json({
      success: true,
      message: "User birth detail created successfully",
      data: userBirthDetail,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      return res.status(422).json({ success: false, message: "Validation failed", errors });
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
    if (gender) filter.gender = gender.toLowerCase();

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
        page: Number(page),
        limit: Number(limit),
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

// ─── Update ──────────────────────────────────────────────────────────────────

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
