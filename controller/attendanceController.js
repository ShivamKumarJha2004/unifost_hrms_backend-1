import express from "express";
import Attendance from "../model/Attendance.js";
import User from "../model/userSchema.js";

// Date helpers
const getStartOfDay = (d) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
};
const getEndOfDay = (d) => {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
};

// Safe parser for optional date inputs from request bodies
// undefined → undefined (no change);  or null → null (clear); invalid → throws
const parseOptionalDate = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const dt = new Date(value);
    if (isNaN(dt.getTime())) {
        throw new Error("Invalid Date");
    }
    return dt;
};

// Parse time strings like "HH:mm" or "HH:mm:ss" by combining with a base date
// If value is a time-only string, baseDate is required (will be used with local time)
const parseOptionalTimeOrDate = (value, baseDateForTime) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value === "string") {
        const timeMatch = value.match(/^([0-1]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
        if (timeMatch) {
            const base = baseDateForTime ? new Date(baseDateForTime) : new Date();
            if (isNaN(base.getTime())) throw new Error("Invalid Date");
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
            base.setHours(hours, minutes, seconds, 0);
            return base;
        }
    }
    // Fallback to normal date parsing
    const dt = new Date(value);
    if (isNaN(dt.getTime())) {
        throw new Error("Invalid Date");
    }
    return dt;
};

// Utility function to format hours in "X hours Y minutes" format
const formatHours = (hours) => {
    if (!hours || hours <= 0) return "0 hours 0 minutes";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    // Handle edge case where minutes round up to 60
    if (minutes === 60) {
        return `${wholeHours + 1} hours 0 minutes`;
    }
    
    return `${wholeHours} hours ${minutes} minutes`;
};

// Utility function to format hours in HH:MM format
const formatHoursHHMM = (hours) => {
    if (!hours || hours <= 0) return "00:00";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    // Handle edge case where minutes round up to 60
    if (minutes === 60) {
        return `${(wholeHours + 1).toString().padStart(2, '0')}:00`;
    }
    
    return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const markAttendance = async (req, res) => {
    try {
        const { date, checkIn, checkOut, status, profilePhoto } = req.body;
        const userId = req.params.id;
        if (!userId || !date) {
            return res.status(400).json({ status: "error", message: "Employee ID and date are required" });
        }
        
        // Always fetch user's details from user schema
        const user = await User.findById(userId).select("name employeeId profilePicture");
        if (!user) {
            return res.status(404).json({ status: "error", message: "Employee not found" });
        }
        const userProfilePhoto = user.profilePicture || profilePhoto || null;
        
        const attendanceDate = new Date(date);
        const existingRecord = await Attendance.findOne({ employeeId: userId, date: attendanceDate });
        if (existingRecord) {
            return res.status(400).json({ status: "error", message: "Attendance already marked for this date" });
        }
        const hoursWorked = checkIn && checkOut ? (new Date(checkOut) - new Date(checkIn)) / 36e5 : 0;
        const newAttendance = new Attendance({
            employeeId: userId,
            employeeName: user.name,
            profilePhoto: userProfilePhoto,
            date: attendanceDate,
            checkIn: checkIn ? new Date(checkIn) : null,
            checkOut: checkOut ? new Date(checkOut) : null,
            hoursWorked,
            status: status || "present"
        });
        await newAttendance.save();
        await newAttendance.populate("employeeId", "name employeeId profilePicture");
        
        // Add formatted hours to response
        const responseAttendance = {
            ...newAttendance.toObject(),
            formattedHours: formatHours(hoursWorked),
            formattedHoursHHMM: formatHoursHHMM(hoursWorked)
        };
        
        return res.status(201).json({ 
            status: "success", 
            message: "Attendance marked successfully", 
            attendance: responseAttendance 
        });
    } catch (error) {
        console.error("markAttendance error:", error);
        return res.status(500).json({ status: "error", message: "Failed to mark attendance", error: error.message });
    }
};
export const getMonthlyAttendance = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        console.log(userRole)
        // assume 'employee' or 'hr'

        let filter = {};
        if (userRole === 'employee') {
            // employee ko sirf apna record dikhaye
            filter = { employeeId: userId };
        } 
        if (userRole ==='manager') {
            console.log("department",req.user.department)
            filter = { department: req.user.department };
        }
        // HR ya admin ko filter empty chhod do → sabka attendance milega

        const records = await Attendance.find(filter)
            .populate("employeeId", "name employeeId email profilePicture");

        // Add formatted hours to each record and ensure profile photo is available
        const recordsWithFormattedHours = records.map(record => {
            const recordObj = record.toObject();
            // Use profile photo from attendance record or fallback to user's profile picture
            const profilePhoto = recordObj.profilePhoto || recordObj.employeeId?.profilePicture || null;
            
            return {
                ...recordObj,
                profilePhoto,
                formattedHours: formatHours(record.hoursWorked),
                formattedHoursHHMM: formatHoursHHMM(record.hoursWorked)
            };
        });

        return res.status(200).json({ 
            status: "success", 
            attendance: recordsWithFormattedHours 
        });

    } catch (error) {
        console.error("getAttendance error:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Failed to fetch attendance records", 
            error: error.message 
        });
    }   
};
export const updateAttendance = async (req, res) => {
    try {
        const {id } = req.params;
        const {employeeName, status, date, checkIn, checkOut, profilePhoto } = req.body;
        
        // Get current attendance record to fetch employeeId
        const currentAttendance = await Attendance.findById(id);
        if (!currentAttendance) {
            return res.status(404).json({ 
                status: "error", 
                message: "Attendance record not found" 
            });
        }
        
        // Fetch user's profile photo from user schema
        const user = await User.findById(currentAttendance.employeeId).select("profilePicture");
        const userProfilePhoto = user?.profilePicture || profilePhoto || null;
        
        // Parse optional date fields safely
        let parsedDate, parsedCheckIn, parsedCheckOut;
        try {
            parsedDate = date !== undefined ? getStartOfDay(date) : undefined;
            const baseForTime = parsedDate ?? currentAttendance.date ?? new Date();
            parsedCheckIn = parseOptionalTimeOrDate(checkIn, baseForTime);
            parsedCheckOut = parseOptionalTimeOrDate(checkOut, baseForTime);
        } catch (e) {
            return res.status(400).json({ status: "error", message: e.message || "Invalid date input" });
        }

        // Calculate work hours only when both checkIn and checkOut are valid non-null
        let hoursWorked;
        if (parsedCheckIn instanceof Date && parsedCheckOut instanceof Date) {
            // Validate that checkOut is after checkIn
            if (parsedCheckOut <= parsedCheckIn) {
                return res.status(400).json({ 
                    status: "error", 
                    message: "Check-out time must be after check-in time" 
                });
            }
            hoursWorked = (parsedCheckOut - parsedCheckIn) / 36e5; // ms to hours
        }
        
        const updateData = {
            employeeName,
            status,
            date: parsedDate,
            checkIn: parsedCheckIn,
            checkOut: parsedCheckOut,
            profilePhoto: userProfilePhoto,
            hoursWorked
        };
        
        // Remove undefined values
        Object.keys(updateData).forEach(key => 
            updateData[key] === undefined && delete updateData[key]
        );
        
        const attendance = await Attendance.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!attendance) {
            return res.status(404).json({ 
                status: "error", 
                message: "Attendance record not found" 
            });
        }
        
        // Add formatted hours to response
        const responseAttendance = {
            ...attendance.toObject(),
            formattedHours: formatHours(hoursWorked ?? attendance.hoursWorked),
            formattedHoursHHMM: formatHoursHHMM(hoursWorked ?? attendance.hoursWorked)
        };
        
        return res.status(200).json({ 
            status: "success", 
            attendance: responseAttendance, 
            message: "Attendance updated successfully" 
        });
    }
    catch (error) {
        console.error("updateAttendance error:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Failed to update attendance", 
            error: error.message 
        });
    }
};
export const deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const attendance = await Attendance.findByIdAndDelete(id);
        return res.status(200).json({ status: "success", attendance,message: "Attendance deleted successfully" });
    }
    catch (error) {
        console.error("deleteAttendance error:", error);
        return res.status(500).json({ status: "error", message: "Failed to delete attendance", error: error.message });
    }
};

export const markBulkAttendance = async (req, res) => {
    try {
        const { date, checkIn, checkOut, status, selectedEmployees, selectAll } = req.body || {};
        if (!date) {
            return res.status(400).json({ status: "error", message: "date is required" });
        }
        const attendanceDate = getStartOfDay(date);
        const checkInDate = checkIn ? new Date(checkIn) : null;
        const checkOutDate = checkOut ? new Date(checkOut) : null;
        const hoursWorked = checkInDate && checkOutDate ? (checkOutDate - checkInDate) / 36e5 : 0;

        // Resolve target employees
        let employeeIds = [];
        if (selectAll) {
            const users = await User.find({}, "_id name");
            employeeIds = users.map(u => ({ id: String(u._id), name: u.name }));
        } else if (Array.isArray(selectedEmployees) && selectedEmployees.length > 0) {
            // selectedEmployees can be list of IDs or objects
            employeeIds = selectedEmployees.map(e => typeof e === "string" ? { id: e } : { id: String(e.id || e._id), name: e.name });
        } else {
            return res.status(400).json({ status: "error", message: "Provide selectedEmployees or set selectAll=true" });
        }

        const results = [];
        let createdCount = 0;
        let skippedCount = 0;

        for (const emp of employeeIds) {
            const employeeId = emp.id;
            const user = await User.findById(employeeId).select("name profilePicture");
            if (!user) {
                results.push({ employeeId, status: "skipped", reason: "user not found" });
                skippedCount++;
                continue;
            }
            // skip if already marked for the date
            const exists = await Attendance.findOne({ employeeId, date: attendanceDate });
            if (exists) {
                results.push({ employeeId, name: user.name, status: "skipped", reason: "already marked" });
                skippedCount++;
                continue;
            }
            const doc = new Attendance({
                employeeId,
                employeeName: user.name,
                profilePhoto: user.profilePicture || null,
                date: attendanceDate,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                hoursWorked,
                status: status || "present"
            });
            await doc.save();
            results.push({ 
                employeeId, 
                name: user.name, 
                status: "created", 
                id: doc._id,
                hoursWorked: doc.hoursWorked,
                formattedHours: formatHours(doc.hoursWorked),
                formattedHoursHHMM: formatHoursHHMM(doc.hoursWorked)
            });
            createdCount++;
        }

        return res.status(201).json({
            status: "success",
            message: "Bulk attendance processed",
            summary: { created: createdCount, skipped: skippedCount, total: employeeIds.length },
            results
        });
    } catch (error) {
        console.error("markBulkAttendance error:", error);
        return res.status(500).json({ status: "error", message: "Failed to mark bulk attendance", error: error.message });
    }
};

// Today's attendance summary (present/absent/late counts)
export const getTodayAttendanceSummary = async (req, res) => {
    try {
        const now = new Date();
        let rangeStart = getStartOfDay(now);
        let rangeEnd = getEndOfDay(now);

        const hasToday = await Attendance.exists({ date: { $gte: rangeStart, $lt: rangeEnd } });
        if (!hasToday) {
            const nextStart = new Date(rangeStart);
            nextStart.setDate(nextStart.getDate() + 1);
            const nextEnd = new Date(rangeEnd);
            nextEnd.setDate(nextEnd.getDate() + 1);
            rangeStart = nextStart;
            rangeEnd = nextEnd;
        }

        const [present, absent, late,onLeave] = await Promise.all([
            Attendance.countDocuments({ date: { $gte: rangeStart, $lt: rangeEnd }, status: { $regex: /^present$/i } }),
            Attendance.countDocuments({ date: { $gte: rangeStart, $lt: rangeEnd }, status: { $regex: /^absent$/i } }),
            Attendance.countDocuments({ date: { $gte: rangeStart, $lt: rangeEnd }, status: { $regex: /^late$/i } }),
            Attendance.countDocuments({ date: { $gte: rangeStart, $lt: rangeEnd }, status: { $regex: /^leave$/i } })
        ]);
        console.log("Today's attendance summary", { present, absent, late });

        return res.status(200).json({
            status: "success",
            window: { start: rangeStart, end: rangeEnd },
            counts: { present, absent, late }
        });
    } catch (error) {
        console.error("getTodayAttendanceSummary error:", error);
        return res.status(500).json({ status: "error", message: "Failed to fetch today's attendance summary", error: error.message });
    }
};

export const getAttendance = getMonthlyAttendance;


