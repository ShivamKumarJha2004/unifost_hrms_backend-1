// routes/kraManagementRoutes.js
// Path: unifost_hrms_backend/routes/kraManagementRoutes.js

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  markDailyKRA,
  getMonthlyKRA,
  getTeamKRA,
  submitCounselorReport,
  getPendingCounselorReports,
  verifyCounselorReport,
  rejectCounselorReport
} from "../controller/kraController.js";

const router = express.Router();

// Counselor KRA endpoints
router.post("/counselor/submit", authenticateToken, submitCounselorReport);
router.get("/counselor/pending", authenticateToken, getPendingCounselorReports);
router.post("/counselor/verify", authenticateToken, verifyCounselorReport);
router.post("/counselor/reject", authenticateToken, rejectCounselorReport);

// Manager daily KRA rating de
router.post("/mark", authenticateToken, markDailyKRA);

// Employee apni monthly KRA dekhe
router.get("/monthly", authenticateToken, getMonthlyKRA);

// Manager apni poori team ki KRA dekhe
router.get("/team", authenticateToken, getTeamKRA);

// Monthly KRA summary dekhe
router.get("/:employeeId", authenticateToken, getMonthlyKRA);

export default router;