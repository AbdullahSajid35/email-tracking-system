import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema(
  {
    isRunning: { type: Boolean, default: false },
    acknowledged: { type: Boolean, default: false },
    lastRun: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
//Setting
const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);
export default Setting;
