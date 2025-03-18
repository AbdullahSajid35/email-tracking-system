import { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    minLength: [2, "Name must be at least 2 characters long"],
    maxLength: [50, "Name must be less than 50 characters long"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minLength: [6, "Password must be at least 6 characters long"],
  },
  role: {
    type: String,
    enum: ["USER", "ADMIN"],
    default: "VIEWER",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = models.User || model("User", UserSchema);

export default User;
