import { Router } from "express";
import {
  createUserBirthDetail,
  getAllUserBirthDetails,
  getUserBirthDetailById,
  updateUserBirthDetail,
  updateFcmToken,
  deleteUserBirthDetail,
} from "../controllers/userBirthDetailController.js";
import {
  createUserBirthDetailRules,
  updateUserBirthDetailRules,
} from "../middleware/validators.js";

const router = Router();

/**
 * @route   POST /api/users
 * @desc    Create or Update user birth details.
 *          If a record with the same deviceId already exists, it is updated.
 *          Otherwise a new record is created.
 *          Response includes `isNew: true | false` so the client knows which happened.
 * @body    { name, gender, deviceId, fcmToken, dateOfBirth, timeOfBirth, placeOfBirth }
 * @access  Public
 */
router.post("/", createUserBirthDetailRules, createUserBirthDetail);

/**
 * @route   GET /api/users
 * @desc    Get all user records (paginated, filterable by deviceId / gender)
 * @query   page, limit, deviceId, gender
 * @access  Public
 */
router.get("/", getAllUserBirthDetails);

/**
 * @route   PATCH /api/users/fcm-token
 * @desc    Update only the FCM token for a device.
 *          Call this from your React Native app whenever
 *          messaging().onTokenRefresh() fires.
 * @body    { deviceId, fcmToken }
 * @access  Public
 */
router.patch("/fcm-token", updateFcmToken);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user record by MongoDB _id
 * @access  Public
 */
router.get("/:id", getUserBirthDetailById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update any field(s) on a user record by MongoDB _id
 * @access  Public
 */
router.put("/:id", updateUserBirthDetailRules, updateUserBirthDetail);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user record by MongoDB _id
 * @access  Public
 */
router.delete("/:id", deleteUserBirthDetail);

export default router;
