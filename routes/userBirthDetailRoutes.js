import { Router } from "express";
import {
  createUserBirthDetail,
  getAllUserBirthDetails,
  getUserBirthDetailById,
  updateUserBirthDetail,
  deleteUserBirthDetail,
} from "../controllers/userBirthDetailController.js";
import {
  createUserBirthDetailRules,
  updateUserBirthDetailRules,
} from "../middleware/validators.js";

const router = Router();

/**
 * @route   POST /api/users
 * @desc    Create a new user birth detail record
 * @access  Public
 */
router.post("/", createUserBirthDetailRules, createUserBirthDetail);

/**
 * @route   GET /api/users
 * @desc    Get all user birth detail records (paginated, filterable)
 * @query   page, limit, deviceId, gender
 * @access  Public
 */
router.get("/", getAllUserBirthDetails);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user birth detail by ID
 * @access  Public
 */
router.get("/:id", getUserBirthDetailById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user birth detail record
 * @access  Public
 */
router.put("/:id", updateUserBirthDetailRules, updateUserBirthDetail);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user birth detail record
 * @access  Public
 */
router.delete("/:id", deleteUserBirthDetail);

export default router;
