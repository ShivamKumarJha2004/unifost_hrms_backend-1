// model/KRA.js
// Path: unifost_hrms_backend/model/KRA.js

import mongoose from "mongoose";

const DailyRatingSchema = new mongoose.Schema(
  {
    date:    { type: Date,   required: true },
    rating:  { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const KRASchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month:  { type: Number, required: true }, // 1–12
    year:   { type: Number, required: true },

    dailyRatings: [DailyRatingSchema],

    monthlyAverage:  { type: Number, default: 0 },

    ratingCategory: {
      type: String,
      enum: ["Excellent", "Good", "Average", "Poor"],
      default: "Average",
    },

    bonusPercentage: { type: Number, default: 0 }, // -10 to +20
  },
  { timestamps: true }
);

// Ek employee ka ek mahine mein ek KRA
KRASchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

const KRA = mongoose.model("KRA", KRASchema);
export default KRA;