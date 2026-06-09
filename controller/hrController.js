import User from "../model/userSchema.js";
import Attendance from "../model/Attendance.js";
import EmployeeLeave from "../model/EmployeeLeaveSchema.js";
import Announcement from "../model/AnnouncementSchema.js";
import ForgetPasswordRequest from "../model/ForgetPasswordRequest.js"
import bcrypt from "bcrypt";




export const getEmployee = async (req, res) => {
  try {
    const employees = await User.find({}, { 
      _id: 1, 
      name: 1, 
      employeeId: 1, 
      designation: 1, 
      department: 1 
    });

    res.status(200).json({
      success: true,
      employees,
      message: "employee data fetched successfully"
    });
  } catch (error) {
    console.error("getEmployee error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message
    });
  }
}

export const updateEmployeeSalary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { basic, hra, specialAllowance, pfContribution } = req.body;

    const totalMonthly = (Number(basic) || 0) + (Number(hra) || 0) + (Number(specialAllowance) || 0);
    const totalAnnual = totalMonthly * 12;

    const updatedUser = await User.findByIdAndUpdate(
      employeeId,
      {
        $set: {
          "salary.basic": basic,
          "salary.hra": hra,
          "salary.specialAllowance": specialAllowance,
          "salary.pfContribution": pfContribution,
          "salary.totalMonthly": totalMonthly,
          "salary.totalAnnual": totalAnnual
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Salary structure updated successfully",
      salary: updatedUser.salary
    });
  } catch (error) {
    console.error("updateEmployeeSalary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update salary structure",
      error: error.message
    });
  }
};
export const getEmployeeById = async (req, res) => {
  try {
    const id = req.params.id;

    const getEmployeebyId = await User.findById(id);

    if (!getEmployeebyId) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    return res.status(200).json({
      success: true,
      employee: getEmployeebyId,
      message: "Employee data fetched successfully"
    });

  } catch (error) {
    console.error("getEmployeeById error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch employee by id",
      error: error.message
    });
  }
};
export const getHrDashboardWithAttendance = async (req, res) => {
  try {
    const requester = req.user;


    if (!requester || requester.role !== "hr" && requester.role !== "manager") {
      return res.status(403).json({
        status: "error",
        message: "Only HR has permission to access this route"
      });
    }

    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const [employeeCount, departmentwiseEmployeeCount, newJoinersCount, pendingLeavesCount] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ department: requester.department }),
        User.countDocuments({ joiningDate: { $gte: oneMonthAgo, $lte: now } }),
        EmployeeLeave.countDocuments({ status: "pending" }),

      ]);
    console.log(requester.department)



    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let rangeStart = today;
    let rangeEnd = tomorrow;
    let attendance = await Attendance.find({
      date: { $gte: rangeStart, $lt: rangeEnd }
    }).lean();

    if (!attendance || attendance.length === 0) {
      const nextDay = new Date(tomorrow);
      const dayAfterNext = new Date(nextDay);
      dayAfterNext.setDate(dayAfterNext.getDate() + 1);

      rangeStart = nextDay;
      rangeEnd = dayAfterNext;

      attendance = await Attendance.find({
        date: { $gte: rangeStart, $lt: rangeEnd }
      }).lean();
    }

    const presentCount = await Attendance.countDocuments({

      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "present"
    });
    const departmentwisePresentCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "present",
      department: requester.department
    });
    const departmentwiseAbsentCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "absent",
      department: requester.department
    });
    const departmentwiseLateCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "late",
      department: requester.department
    });
    const departmentwiseOnLeaveCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "late",
      department: requester.department
    });

    const absentCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "absent"
    });

    const lateCount = await Attendance.countDocuments({
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: "late"
    });

    console.log("Attendance counts window", { rangeStart, rangeEnd, presentCount, absentCount, lateCount });
    const TEN_DAYS = 10;
    const usersWithDob = await User.find({ dob: { $ne: "" } })
      .select("_id name employeeId department designation dob email profilePicture")
      .lean();
    console.log(usersWithDob);

    const startOfTodayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const upcomingBirthdays = usersWithDob
      .map(u => {
        const raw = u.dob instanceof Date ? u.dob : new Date(u.dob);
        if (isNaN(raw.getTime())) return null;
        const month = raw.getUTCMonth();
        const day = raw.getUTCDate();
        let nextOccurUtc = new Date(Date.UTC(startOfTodayUtc.getUTCFullYear(), month, day));
        if (nextOccurUtc < startOfTodayUtc) {
          nextOccurUtc = new Date(Date.UTC(startOfTodayUtc.getUTCFullYear() + 1, month, day));
        }
        const diffDays = Math.floor((nextOccurUtc - startOfTodayUtc) / 86400000);
        if (diffDays < 0 || diffDays > TEN_DAYS) return null;
        return { ...u, nextBirthday: nextOccurUtc, diffDays };
      })
      .filter(Boolean)
      .sort((a, b) => a.nextBirthday - b.nextBirthday)
      .map(({ nextBirthday, diffDays, ...rest }) => rest);


    res.status(200).json({
      success: true,
      stats: {
        totalEmployees: employeeCount,
        departmentwiseEmployees: departmentwiseEmployeeCount,
        newJoiners: newJoinersCount,
        pendingLeaves: pendingLeavesCount
      },
      attendanceReport: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        records: attendance,
        departmentwisePresent: departmentwisePresentCount,
        departmentwiseAbsent: departmentwiseAbsentCount,
        departmentwiseLate: departmentwiseLateCount,
        departmentwiseOnLeave: departmentwiseOnLeaveCount
      },
      birthdays: upcomingBirthdays,
      message:
        "HR dashboard stats, attendance & birthdays fetched successfully"
    });
  } catch (error) {
    console.error("getHrDashboardWithAttendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch HR dashboard stats & attendance",
      error: error.message
    });
  }
};

export const getUpcomingLeave = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingLeaves = await EmployeeLeave.find({
      employeeRole: { $ne: "hr" }
    }).populate("employeeId", "name email profilePicture").sort({ startDate: 1 });

    console.log("Total Leaves Found:", upcomingLeaves.length);

    res.status(200).json({
      success: true,
      upcomingLeaves,
      message: "Upcoming leaves fetched successfully"
    });
  } catch (error) {
    console.error("getUpcomingLeave error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming leaves",
      error: error.message
    });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User id is required"
      });
    }

    const { subject, audience, publishedDate, expiryDate, body, image, document } = req.body;

    if (!subject || !audience || !publishedDate || !expiryDate || !body) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Create announcement
    const newAnnouncement = new Announcement({
      user: userId,
      subject,
      audience,
      publishedDate: new Date(publishedDate),
      expiryDate: new Date(expiryDate),
      body,
      image: image || null,
      document: document || null,
    });

    await newAnnouncement.save();

    return res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data: newAnnouncement
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};


export const getAnnouncement = async (req, res) => {
  const announcement = await Announcement.find();
  res.status(200).json({
    success: true,
    announcement,
    message: "Announcement fetched successfully"
  });
}
export const deleteEmployee = async (req, res) => {
  const id = req.params.id;
  const employee = await User.findByIdAndDelete(id);
  res.status(200).json({
    success: true,
    employee,
    message: "Employee deleted successfully"
  });
}
export const getforgetPasswordRequest = async (req, res) => {
  const forgetPasswordRequest = await ForgetPasswordRequest.find();
  res.status(200).json({
    success: true,
    forgetPasswordRequest,
    message: "Forget password request fetched successfully"
  });
}

export const editPassword = async (req, res) => {
  try {
    const { email, newpassword } = req.body;

    if (!email || !newpassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newpassword, 10);

    // Update the user's password
    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email not found",
      });
    }

    // Update the status of the related forget password request
    const statusUpdate = await ForgetPasswordRequest.findOneAndUpdate(
      { email },
      { status: "approved" },
      { new: true }
    );
    if (statusUpdate) {
      return res.json({
        statusUpdate,
        success: true,
        message: "Status is Approved"
      })
    }

    console.log("New hashed password:", user.password);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
      user,

    });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const deleteforgetPasswordRequest = async (req, res) => {
  const { id } = req.params;
  const forgetPasswordRequest = await ForgetPasswordRequest.findByIdAndDelete(id);
  res.status(200).json({
    success: true,
    forgetPasswordRequest,
    message: "Forget password request deleted successfully"
  });
}



