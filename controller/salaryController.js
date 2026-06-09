// controller/salaryController.js
// Path: unifost_hrms_backend/controller/salaryController.js

import Attendance from "../model/Attendance.js";
import KRA        from "../model/KRA.js";
import User       from "../model/userSchema.js"; // aapka existing User model
import { calculateMonthlySalary } from "../utils/salaryHelper.js";
import PDFDocument from "pdfkit";

// ── Get Salary Breakdown ─────────────────────────────────────────────────────
// GET /api/salary/:employeeId?month=1&year=2026
export const getSalaryBreakdown = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: "month aur year required hai" });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    // Employee info
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee nahi mila" });
    }

    // Attendance records
    const startDate = new Date(y, m - 1, 1);
    const endDate   = new Date(y, m, 0);

    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate },
    });

    // KRA record
    const kraRecord = await KRA.findOne({ employeeId, month: m, year: y });

    // Working days calculate karo (weekends nikalo)
    let totalWorkingDays = 0;
    const temp = new Date(startDate);
    while (temp <= endDate) {
      const dow = temp.getDay();
      if (dow !== 0 && dow !== 6) totalWorkingDays++;
      temp.setDate(temp.getDate() + 1);
    }

    // Salary calculate
    const salaryBreakdown = calculateMonthlySalary({
      salaryStructure:  employee.salary || {},
      attendanceList:  attendanceRecords,
      kraBonus:        kraRecord?.bonusPercentage || 0,
      totalWorkingDays,
    });

    return res.status(200).json({
      success: true,
      data: {
        employee: {
          _id:         employee._id,
          name:        employee.name,
          designation: employee.designation || employee.role || "",
          department:  employee.department  || "",
          employeeId:  employee.employeeCode || employee._id.toString().slice(-6).toUpperCase(),
          email:       employee.email,
        },
        month: m,
        year:  y,
        kra: kraRecord
          ? {
              average:  kraRecord.monthlyAverage,
              category: kraRecord.ratingCategory,
              bonus:    kraRecord.bonusPercentage,
            }
          : null,
        salary: salaryBreakdown,
      },
    });
  } catch (err) {
    console.error("getSalaryBreakdown error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get My Salary (Employee apni salary dekhe) ────────────────────────────────
// GET /api/salary/my?month=1&year=2026
export const getMySalary = async (req, res) => {
  req.params.employeeId = req.user._id.toString();
  return getSalaryBreakdown(req, res);
};

// ── Generate Salary Slip PDF ──────────────────────────────────────────────────
// GET /api/salary/slip/:employeeId/:month/:year
export const generateSalarySlip = async (req, res) => {
  try {
    const { employeeId, month, year } = req.params;
    const m = parseInt(month);
    const y = parseInt(year);

    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).send("Employee not found");

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate },
    });

    const kraRecord = await KRA.findOne({ employeeId, month: m, year: y });

    let totalWorkingDays = 0;
    const temp = new Date(startDate);
    while (temp <= endDate) {
      const dow = temp.getDay();
      if (dow !== 0 && dow !== 6) totalWorkingDays++;
      temp.setDate(temp.getDate() + 1);
    }

    const salary = calculateMonthlySalary({
      salaryStructure: employee.salary || {},
      attendanceList: attendanceRecords,
      kraBonus: kraRecord?.bonusPercentage || 0,
      totalWorkingDays,
    });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=SalarySlip_${employeeId}_${m}_${y}.pdf`);
    doc.pipe(res);

    // --- PDF Content ---
    doc.fontSize(20).text("UNIFOST - Salary Slip", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Month: ${m}/${y}`, { align: "right" });
    doc.moveDown();

    doc.text(`Employee Name: ${employee.name}`);
    doc.text(`Employee ID: ${employee.employeeId}`);
    doc.text(`Designation: ${employee.designation}`);
    doc.text(`Department: ${employee.department}`);
    doc.moveDown();

    doc.lineCap("butt").moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    const startY = doc.y;
    doc.text("Earnings", 50, startY, { underline: true });
    doc.text(`Basic: ${salary.basicSalary}`, 50, startY + 20);
    doc.text(`HRA: ${salary.hra}`, 50, startY + 40);
    doc.text(`Special Allowance: ${salary.specialAllowance}`, 50, startY + 60);
    doc.text(`KRA Bonus: ${salary.kraAmount}`, 50, startY + 80);
    doc.text(`Gross Salary: ${salary.grossSalary}`, 50, startY + 110, { bold: true });

    doc.text("Deductions", 300, startY, { underline: true });
    doc.text(`PF: ${salary.pf}`, 300, startY + 20);
    doc.text(`ESIC: ${salary.esic}`, 300, startY + 40);
    doc.text(`TDS: ${salary.tds}`, 300, startY + 60);
    doc.text(`Late Deduction: ${salary.lateDeduction}`, 300, startY + 80);
    doc.text(`Total Deductions: ${salary.totalDeductions}`, 300, startY + 110, { bold: true });

    doc.moveDown(8);
    doc.fontSize(14).text(`Net Salary: ${salary.netSalary} INR`, { align: "center", bold: true });
    
    doc.moveDown(4);
    doc.fontSize(10).text("This is a computer generated document and does not require a signature.", { align: "center", italic: true });

    doc.end();
  } catch (err) {
    console.error("generateSalarySlip error:", err);
    res.status(500).send("Error generating PDF");
  }
};