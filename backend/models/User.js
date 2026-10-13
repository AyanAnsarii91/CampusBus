import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxLength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: false, select: false },
    firebaseUid: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["student", "driver", "admin"],
      default: "student",
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    studentId: { type: String, trim: true },
    phone: { type: String, trim: true, maxLength: 32 },
    dob: { type: String, trim: true }, // YYYY-MM-DD
    profilePhoto: { type: String, trim: true }, // Supabase storage path: profiles/{userId}/avatar.{ext}
    assignedStop: { type: mongoose.Schema.Types.ObjectId, ref: "BusStop" },
    assignedBusId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
export default mongoose.model("User", schema);
