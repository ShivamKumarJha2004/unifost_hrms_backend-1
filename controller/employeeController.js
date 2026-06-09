import Attendance from "../model/Attendance.js";
import ForgetPasswordRequest from "../model/ForgetPasswordRequest.js";
import User from "../model/userSchema.js";
const documentImageUploader = {
  adharImage: "documents.adharImage",
  panImage: "documents.panImage",
  experienceLetterImage: "documents.experienceLetterImage",
  MarksheetImage_10: "documents.MarksheetImage_10",
  MarksheetImage_12: "documents.MarksheetImage_12",
  MarksheetImage_Graduation: "documents.MarksheetImage_Graduation",
  MarksheetImage_PostGraduationImage: "documents.MarksheetImage_PostGraduationImage"
};

const allowedDocumentKeys = new Set(Object.keys(documentImageUploader));

// Upload single document one by one - dedicated endpoint
export const uploadSingleDocument = async (req, res) => {
  try {
    const targetUserId = req.params.id || (req.user && req.user._id);

    if (!targetUserId) {
      console.log("ERROR: No target user ID found");
      return res.status(400).json({ status: "error", message: "Employee id is required" });
    }

    const requester = req.user;
    const isSelf = requester && String(requester._id) === String(targetUserId);
    const isPrivileged = requester && ["admin", "hr", "manager"].includes(requester.role);
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ status: "error", message: "Not authorized to update this employee" });
    }

    // Check if file is provided
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No file provided. Please upload a document (image or PDF).",
        allowedFields: Array.from(allowedDocumentKeys)
      });
    }

    // Check if more than one file is provided
    if (req.files.length > 1) {
      return res.status(400).json({
        status: "error",
        message: "Only one file allowed at a time. Please upload documents one by one.",
        allowedFields: Array.from(allowedDocumentKeys)
      });
    }

    const file = req.files[0];
    const field = file.fieldname;

    // Validate field name
    if (!allowedDocumentKeys.has(field)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid field name: ${field}. Allowed fields: ${Array.from(allowedDocumentKeys).join(', ')}`
      });
    }

    const pathKey = documentImageUploader[field];
    const docUpdates = {
      [pathKey]: file.path // cloudinary url
    };

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      { $set: docUpdates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ status: "error", message: "Employee not found" });
    }

    return res.status(200).json({
      status: "success",
      message: `Document ${field} uploaded successfully`,
      uploadedField: field,
      documentUrl: file.path,
      user: updated
    });
  } catch (error) {
    console.error("uploadSingleDocument error:", error);
    return res.status(500).json({ status: "error", message: "Failed to upload document", error: error.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const targetUserId = req.params.id || (req.user && req.user._id);
    if (!targetUserId) {
      return res.status(400).json({ status: "error", message: "Employee id is required" });
    }

    const requester = req.user;
    const isSelf = requester && String(requester._id) === String(targetUserId);
    const isPrivileged = requester && ["admin", "hr", "manager"].includes(requester.role);
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ status: "error", message: "Not authorized to update this employee" });
    }

    // Disallow these fields from being updated here
    const forbiddenFields = new Set(["_id", "id", "password", "username", "role", "createdAt", "updatedAt", "__v"]);


    const updates = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!forbiddenFields.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ status: "error", message: "No valid fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ status: "error", message: "Employee not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "Employee updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("updateEmployee error:", error);
    return res.status(500).json({ status: "error", message: "Failed to update employee", error: error.message });
  }
};

// Update employee documents from multer files or direct URLs
export const updateEmployeeDocuments = async (req, res) => {
  try {
    const targetUserId = req.params.id || (req.user && req.user._id);
    if (!targetUserId) {
      return res.status(400).json({ status: "error", message: "Employee id is required" });
    }

    const requester = req.user;
    const isSelf = requester && String(requester._id) === String(targetUserId);
    const isPrivileged = requester && ["admin", "hr", "manager"].includes(requester.role);
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ status: "error", message: "Not authorized to update this employee" });
    }

    const docUpdates = {};
    let uploadedField = null;

    // Handle single file upload (one by one)
    if (req.files && req.files.length === 1) {
      const file = req.files[0];
      const field = file.fieldname;

      if (allowedDocumentKeys.has(field)) {
        const pathKey = documentImageUploader[field];
        docUpdates[pathKey] = file.path; // cloudinary url
        uploadedField = field;
      } else {
        return res.status(400).json({
          status: "error",
          message: `Invalid field name: ${field}. Allowed fields: ${Array.from(allowedDocumentKeys).join(', ')}`
        });
      }
    }
    // Handle multiple files upload
    else if (Array.isArray(req.files) && req.files.length > 1) {
      for (const file of req.files) {
        const field = file.fieldname;
        if (allowedDocumentKeys.has(field)) {
          const pathKey = documentImageUploader[field];
          docUpdates[pathKey] = file.path; // cloudinary url
        }
      }
    }
    // Handle direct URL strings in body
    else {
      for (const key of allowedDocumentKeys) {
        if (typeof req.body?.[key] === 'string' && req.body[key].length > 0) {
          const pathKey = documentImageUploader[key];
          docUpdates[pathKey] = req.body[key];
          uploadedField = key;
        }
      }
    }

    if (Object.keys(docUpdates).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No document fields provided. Send file with field name or URL in body.",
        allowedFields: Array.from(allowedDocumentKeys)
      });
    }

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      { $set: docUpdates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ status: "error", message: "Employee not found" });
    }

    return res.status(200).json({
      status: "success",
      message: uploadedField ?
        `Document ${uploadedField} uploaded successfully` :
        "Documents updated successfully",
      uploadedField: uploadedField,
      user: updated
    });
  } catch (error) {
    console.error("updateEmployeeDocuments error:", error);
    return res.status(500).json({ status: "error", message: "Failed to update documents", error: error.message });
  }
};
export const  getEmployeebypagination = async (req, res) => {
  try {



    let { page, limit, sortBy, sortOrder, search, department, status } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const skip = (page - 1) * limit;


    let query = {};

    // 🔹 If logged-in user is manager → restrict by department
    if (req.user?.role === "manager") {
      query.department = req.user.department; // e.g. "sales"
    }


    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { empCode: { $regex: search, $options: 'i' } }
      ];
    }

    // 🔹 Apply department filter from query (only for non-managers)
    if (department && department !== 'all' && req.user?.role !== "manager") {
      query.department = department;
    }

    // 🔹 Apply status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Sort setup
    let sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }




    const [employees, totalEmployees] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(query)
    ]);
    const totalPages = Math.ceil(totalEmployees / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    return res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        currentPage: page,
        totalPages,
        totalEmployees,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      },
      message: "Employee data fetched successfully"
    });

  } catch (error) {
    console.error("getEmployee error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message
    });
  }
};

export const getDashboardData = async (req, res) => {
  try {
    const targetUserId = req.params.id || (req.user && req.user._id);

    if (!targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "Employee id is required"
      });
    }


    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const monthlyRecords = await Attendance.find({
      employeeId: targetUserId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalWorkingDays = monthlyRecords.length;
    const presentDays = monthlyRecords.filter(r => r.status?.toLowerCase() === "present").length;
    const absentDays = monthlyRecords.filter(r => r.status?.toLowerCase() === "absent").length;
    const lateDays = monthlyRecords.filter(r => r.status?.toLowerCase() === "late").length;


    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysRecord = await Attendance.findOne({
      employeeId: targetUserId,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ date: -1 });

    const formatISTDate = (date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(date);
    let todaysAttendance;
    console.log("todaysRecord", todaysRecord)
    if (!todaysRecord) {
      todaysAttendance = {
        date: today,
        localDate: formatISTDate(today),
        status: "Absent (No check-in)",
        checkIn: null,
        checkOut: null,
        hoursWorked: 0
      };
    } else {
      todaysAttendance = {
        date: todaysRecord.date,
        localDate: formatISTDate(todaysRecord.date),
        status: todaysRecord.status || (todaysRecord.checkIn ? "Present" : "Absent"),
        checkIn: todaysRecord.checkIn,
        checkOut: todaysRecord.checkOut,
        hoursWorked: todaysRecord.hoursWorked || 0
      };
    }

    // =======================
    // 🔹 Final Response
    // =======================
    res.status(200).json({
      status: "success",
      data: {
        monthly: {
          totalWorkingDays,
          presentDays,
          absentDays,
          lateDays,
          attendance: monthlyRecords
        },
        today: todaysAttendance
      }
    });

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      status: "error",
      message: "Error fetching dashboard data",
      error: error.message
    });
  }
};
export const SendforgetPasswordRequest = async (req, res) => {
  try {
    const { name, email, role, department, designation } = req.body;
    if (!name || !email || !role || !department || !designation) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required"
      });
    }


    const forgetPasswordRequest = await ForgetPasswordRequest.create({
      name,
      email,
      role,
      department,
      designation
    });
    return res.status(200).json({
      status: "success",
      message: "Forget password request created successfully",
      forgetPasswordRequest
    });
  }
  catch (error) {
    console.error("getforgetPasswordRequest error:", error);
  }
}
export const checkEmailExist = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email provided
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check email in database
    const user = await User.findOne({ email });
    console.log(user);

    if (user) {
      // Email exists in DB
      return res.status(200).json({
        success: true,
        message: "Email exists",
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } else {
      // Email not found
      return res.status(404).json({
        success: false,
        message: "User with this email not found"
      });
    }

  } catch (error) {
    console.error("Error checking email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


