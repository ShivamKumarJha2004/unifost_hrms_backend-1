import { register, login, logout, getUserProfile } from "../controller/authController.js";
import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { updateEmployee, getDashboardData, getEmployeebypagination } from "../controller/employeeController.js";
import { enforceLoginRestrictions } from "../middleware/loginRestrictions.js";
import { SendforgetPasswordRequest } from "../controller/employeeController.js";
import { checkEmailExist } from "../controller/employeeController.js";



const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login",enforceLoginRestrictions, login);

// Protected routes (require authentication)
router.post("/logout", authenticateToken, logout);
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile/update", authenticateToken, updateEmployee);
router.put("/employee/:id", authenticateToken, updateEmployee);
router.get("/getEmployeesbypagination", authenticateToken, getEmployeebypagination);
router.get("/getDashboard", authenticateToken, getDashboardData);
router.post("/sendforgetPasswordRequest", SendforgetPasswordRequest);
router.post("/check-user-exist-with-Email", checkEmailExist)

export default router;
