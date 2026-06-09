import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getEmployeebypagination } from "../controller/employeeController.js";
import { getAttendance, markAttendance, updateAttendance, deleteAttendance, markBulkAttendance, getTodayAttendanceSummary } from "../controller/attendanceController.js";
import { createAnnouncement, getAnnouncement, getEmployee, getEmployeeById, getHrDashboardWithAttendance, updateEmployeeSalary } from "../controller/hrController.js"
import { getUpcomingLeave, deleteEmployee } from "../controller/hrController.js"
import { getforgetPasswordRequest, editPassword } from "../controller/hrController.js"

const hrRouter = express.Router();

// Existing routes
hrRouter.get("/getEmployeesbypagination", authenticateToken, getEmployeebypagination);
hrRouter.get("/getEmployees", authenticateToken, getEmployee);
hrRouter.get("/getEmployee/:id", authenticateToken, getEmployeeById);
hrRouter.post("/markAttendance/:id", authenticateToken, markAttendance);
hrRouter.post("/bulkAttendance", authenticateToken, markBulkAttendance);
hrRouter.get('/getAttendance', authenticateToken, getAttendance)
hrRouter.put('/updateAttendance/:id', authenticateToken, updateAttendance)
hrRouter.delete('/deleteAttendance/:id', authenticateToken, deleteAttendance)
hrRouter.get('/getHrDashboardWithAttendance', authenticateToken, getHrDashboardWithAttendance)
hrRouter.get('/getupcomingLeaves', authenticateToken, getUpcomingLeave)
hrRouter.post('/createAnnouncement', authenticateToken, createAnnouncement)
hrRouter.get('/getAnnouncement', authenticateToken, getAnnouncement)
hrRouter.get('/getTodayAttendanceSummary', authenticateToken, getTodayAttendanceSummary)
hrRouter.delete('/deleteEmployee/:id', authenticateToken, deleteEmployee)
hrRouter.put("/employee-salary/:employeeId", authenticateToken, updateEmployeeSalary);
hrRouter.get("/getforgetPasswordRequest", authenticateToken, getforgetPasswordRequest);
hrRouter.put("/reset-password", authenticateToken, editPassword)



export default hrRouter;