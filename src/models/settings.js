import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema(
  {
    isRunning: { type: Boolean, default: false },
    acknowledged: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    delayTime: { type: Number, default: 120 },
    currentUser: { type: String, default: "" }, // Store the session ID of the current user
  },
  { timestamps: true }
);

// Setting
const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);
export default Setting;
