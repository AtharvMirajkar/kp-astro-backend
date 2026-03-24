import mongoose from "mongoose";

const userBirthDetailSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: {
        values: ["male", "female", "other", "prefer_not_to_say"],
        message:
          "{VALUE} is not a valid gender. Use: male, female, other, prefer_not_to_say",
      },
      lowercase: true,
    },
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      trim: true,
      unique: true, // one record per physical device
    },
    fcmToken: {
      type: String,
      required: [true, "FCM token is required"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: (value) => value <= new Date(),
        message: "Date of birth cannot be in the future",
      },
    },
    timeOfBirth: {
      type: String,
      required: [true, "Time of birth is required"],
      trim: true,
      match: [
        /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/,
        "Time of birth must be in HH:MM or HH:MM:SS format",
      ],
    },
    placeOfBirth: {
      type: String,
      required: [true, "Place of birth is required"],
      trim: true,
      minlength: [2, "Place of birth must be at least 2 characters"],
      maxlength: [200, "Place of birth cannot exceed 200 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Index on fcmToken for fast notification lookups
userBirthDetailSchema.index({ deviceId: 1, fcmToken: 1, createdAt: -1 });

const UserBirthDetail = mongoose.model(
  "UserBirthDetail",
  userBirthDetailSchema,
);

export default UserBirthDetail;
