import mongoose from "mongoose";

const CounselorReportSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    calls: { type: Number, required: true },
    talktime: { type: Number, required: true }, // in minutes
    sales: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["pending", "verified", "rejected"], 
        default: "pending" 
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },
    markedStatus: { type: String, enum: ["present", "half-day", null], default: null }
}, { timestamps: true });

// Ensure one report per employee per day
CounselorReportSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const CounselorReport = mongoose.model("CounselorReport", CounselorReportSchema);
export default CounselorReport;
