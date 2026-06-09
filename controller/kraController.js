// controller/kraController.js
// Path: unifost_hrms_backend/controller/kraController.js

import KRA from "../model/KRA.js";
import CounselorReport from "../model/CounselorReport.js";
import Attendance from "../model/Attendance.js";
import User from "../model/userSchema.js";
import { getKRABonus } from "../utils/salaryHelper.js";

// ── Mark Daily KRA ────────────────────────────────────────────────────────────
// POST /api/kra/mark
// Manager employee ko rating deta hai
export const markDailyKRA = async (req, res) => {
  try {
    const { employeeId, date, rating, comment } = req.body;
    const managerId = req.user._id; // authenticateToken se aata hai

    if (!employeeId || !date || !rating) {
      return res.status(400).json({
        success: false,
        message: "employeeId, date, rating required hai",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating 1 se 5 ke beech honi chahiye",
      });
    }

    const ratingDate = new Date(date);
    const month      = ratingDate.getMonth() + 1;
    const year       = ratingDate.getFullYear();

    // Monthly KRA record khojo ya create karo
    let kraRecord = await KRA.findOne({ employeeId, month, year });

    if (!kraRecord) {
      kraRecord = new KRA({ employeeId, managerId, month, year, dailyRatings: [] });
    }

    // Us din ki existing rating update karo
    const idx = kraRecord.dailyRatings.findIndex(
      (r) => new Date(r.date).toDateString() === ratingDate.toDateString()
    );

    if (idx >= 0) {
      kraRecord.dailyRatings[idx] = { date: ratingDate, rating, comment: comment || "" };
    } else {
      kraRecord.dailyRatings.push({ date: ratingDate, rating, comment: comment || "" });
    }

    // Monthly average update karo
    const avg =
      kraRecord.dailyRatings.reduce((sum, r) => sum + r.rating, 0) /
      kraRecord.dailyRatings.length;

    const { category, bonusPercent } = getKRABonus(avg);

    kraRecord.monthlyAverage  = Math.round(avg * 10) / 10;
    kraRecord.ratingCategory  = category;
    kraRecord.bonusPercentage = bonusPercent;

    await kraRecord.save();

    return res.status(200).json({
      success: true,
      message: "KRA rating save ho gayi!",
      data: kraRecord,
    });
  } catch (err) {
    console.error("markDailyKRA error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Monthly KRA ───────────────────────────────────────────────────────────
// GET /api/kra/monthly?employeeId=xxx&month=1&year=2026
export const getMonthlyKRA = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    const kraRecord = await KRA.findOne({
      employeeId,
      month: parseInt(month),
      year:  parseInt(year),
    }).populate("managerId", "name email");

    if (!kraRecord) {
      return res.status(200).json({
        success: true,
        data: {
          average: 0,
          category: "Average",
          bonus: 0
        }
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        average: kraRecord.monthlyAverage,
        category: kraRecord.ratingCategory,
        bonus: kraRecord.bonusPercentage
      } 
    });
  } catch (err) {
    console.error("getMonthlyKRA error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Team KRA (for Manager) ───────────────────────────────────────────
// GET /api/kra/team?month=1&year=2026
export const getTeamKRA = async (req, res) => {
  try {
    const managerId = req.user._id;
    const { month, year } = req.query;

    const teamKRA = await KRA.find({
      managerId,
      month: parseInt(month),
      year:  parseInt(year),
    }).populate("employeeId", "name email designation department");

    return res.status(200).json({ success: true, data: teamKRA });
  } catch (err) {
    console.error("getTeamKRA error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Counselor KRA: Submit Report ──────────────────────────────────────────────
export const submitCounselorReport = async (req, res) => {
  try {
    const { calls, talktime, sales, date } = req.body;
    const employeeId = req.user._id;

    if (!calls || !talktime || !sales || !date) {
      return res.status(400).json({ success: false, message: "Sabhi fields (calls, talktime, sales, date) required hain." });
    }

    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const newReport = await CounselorReport.findOneAndUpdate(
      { employeeId, date: reportDate },
      { calls, talktime, sales, status: "pending" },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, message: "Report successfully submit ho gayi!", data: newReport });
  } catch (err) {
    console.error("submitCounselorReport error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Counselor KRA: Pending Reports (for Managers) ───────────────────────────────
export const getPendingCounselorReports = async (req, res) => {
  try {
    const managerId = req.user._id;

    // Find employees reporting to this manager
    const employees = await User.find({ reportingTo: managerId.toString() }).select("_id");
    const employeeIds = employees.map(e => e._id);

    const pendingReports = await CounselorReport.find({
      employeeId: { $in: employeeIds },
      status: "pending"
    }).populate("employeeId", "name employeeId department designation");

    return res.status(200).json({ success: true, data: pendingReports });
  } catch (err) {
    console.error("getPendingCounselorReports error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Counselor KRA: Verify Report ───────────────────────────────────────────────
export const verifyCounselorReport = async (req, res) => {
  try {
    const { reportId } = req.body;
    const managerId = req.user._id;

    const report = await CounselorReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: "Report nahi mili." });

    // Fetch User to get kraLimits
    const user = await User.findById(report.employeeId);
    const limits = user?.kraLimits || { calls: 250, talktime: 150, sales: 1 };

    // Logic: calls >= limits.calls OR talktime >= limits.talktime OR sales >= limits.sales -> Present, else Half-day
    const isPresent = report.calls >= (limits.calls || 250) || 
                      report.talktime >= (limits.talktime || 150) || 
                      report.sales >= (limits.sales || 1);
    const statusToMark = isPresent ? "present" : "half-day";

    report.status = "verified";
    report.verifiedBy = managerId;
    report.markedStatus = statusToMark;
    await report.save();

    // Mark Attendance in Attendance Model
    const attendanceDate = new Date(report.date);
    attendanceDate.setHours(0, 0, 0, 0);

    await Attendance.findOneAndUpdate(
      { employeeId: report.employeeId, date: attendanceDate },
      { status: statusToMark },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, message: `Report verified! Attendance marked as ${statusToMark}.`, data: report });
  } catch (err) {
    console.error("verifyCounselorReport error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Counselor KRA: Reject Report ───────────────────────────────────────────────
export const rejectCounselorReport = async (req, res) => {
  try {
    const { reportId, reason } = req.body;
    const managerId = req.user._id;

    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason required hai." });

    const report = await CounselorReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: "Report nahi mili." });

    report.status = "rejected";
    report.verifiedBy = managerId;
    report.rejectionReason = reason;
    await report.save();

    return res.status(200).json({ success: true, message: "Report reject ho gayi.", data: report });
  } catch (err) {
    console.error("rejectCounselorReport error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};