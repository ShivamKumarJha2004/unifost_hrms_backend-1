// routes/salaryRoutes.js
// Path: unifost_hrms_backend/routes/salaryRoutes.js

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getSalaryBreakdown, getMySalary, generateSalarySlip } from "../controller/salaryController.js";

const router = express.Router();

// Employee apni salary dekhe (login user ki)
router.get("/my", authenticateToken, getMySalary);

// Salary slip generation (for employee or HR)
router.get("/slip/:employeeId/:month/:year", authenticateToken, generateSalarySlip);

// HR / Manager kisi bhi employee ki salary dekhe
router.get("/:employeeId", authenticateToken, getSalaryBreakdown);

export default router;