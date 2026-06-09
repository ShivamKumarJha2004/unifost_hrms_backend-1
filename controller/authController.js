import User from "../model/userSchema.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Attendance from "../model/Attendance.js";
import moment from "moment-timezone";
dotenv.config();

const parseFlexibleDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value !== "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    const v = value.trim();
    // dd/mm/yyyy or dd-mm-yyyy
    const m = v.match(/^([0-3]?\d)[\/-](0?[1-9]|1[0-2])[\/-]((?:19|20)?\d\d)$/);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        let y = parseInt(m[3], 10);
        if (y < 100) y += 2000;
        const dt = new Date(y, mo, d);
        return isNaN(dt.getTime()) ? null : dt;
    }
    // Fallback to Date parser (yyyy-mm-dd or ISO)
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
};

export const register = async (req, res) => {
    const {
        username,
        password,
        name,
        phone,
        emergencyContactNo,
        email,
        role,
        employeeId,
        department,
        designation,
        dob,
        joiningDate,
    } = req.body;
    console.log(req.body);

   const requiredFields = [
  "username",
  "password",
  "name",
  "phone",
  "emergencyContactNo",
  "email",
  "role",
  "department",
  "designation",
  "dob",
  "joiningDate"
];

// Find missing fields dynamically
const missing = requiredFields.filter(field => !req.body[field]);

if (missing.length > 0) {
  return res.status(400).json({
    message: "Some required fields are missing",
    missingFields: missing
  });
}


    try {
        const existingUser = await User.findOne({
            $or: [
                { username },
                { email }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this username, email, or employee ID"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate employeeId if not provided
        let finalEmployeeId = employeeId;
        const prefix = "UF";
        const pad = (num) => (num < 10 ? `0${num}` : `${num}`);
        if (!finalEmployeeId || typeof finalEmployeeId !== "string" || finalEmployeeId.trim().length === 0) {
            let counter = await User.countDocuments({}) + 1;
           
            for (let attempts = 0; attempts < 10000; attempts++) {
                const candidate = `${prefix}${pad(counter)}`;
                const exists = await User.exists({ employeeId: candidate });
                if (!exists) {
                    finalEmployeeId = candidate;
                    break;
                }
                counter++;
            }
            if (!finalEmployeeId) {
                return res.status(500).json({ message: "Failed to generate unique employeeId" });
            }
        } else {
            // If provided explicitly, ensure not taken
            const empExists = await User.exists({ employeeId: finalEmployeeId });
            if (empExists) {
                return res.status(400).json({ message: "Provided employeeId already in use" });
            }
        }

        // Prepare user payload
        const payload = {
            username,
            password: hashedPassword,
            name,
            phone,
            email,
            role,
            employeeId: finalEmployeeId,
            department,
            designation,
            dob,
            joiningDate,
        };
        const parsedDob = parseFlexibleDate(dob);
        if (parsedDob) {
            payload.dob = parsedDob;
        }
        const parsedJoiningDate = parseFlexibleDate(joiningDate);
        if (parsedJoiningDate) {
            payload.joiningDate = parsedJoiningDate;
        }

        const user = new User(payload);

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            user: userResponse,
            status: "success",
            message: "User registered successfully"
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            message: "Error registering user",
            error: error.message
        });
    }
};

export const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            status: "error",
            message: "Username and password are required"
        });
    }

    try {
        // Find user and populate all fields
        const user = await User.findOne({ username }).select('+password');
        if (!user) {
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials"
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                status: "error",
                message: "Account is deactivated"
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials"
            });
        }

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign({
            userId: user._id,
            username: user.username,
            role: user.role,
            employeeId: user.employeeId
        }, process.env.JWT_SECRET, {});

        console.log(user)
        const userResponse = user.toObject();
        delete userResponse.password;

        const nowIST = moment().tz("Asia/Kolkata");
        const todayStartIST = moment().tz("Asia/Kolkata").startOf('day').toDate();
        const todayEndIST = moment().tz("Asia/Kolkata").endOf('day').toDate();
        const lateCutoff = moment().tz("Asia/Kolkata").set({ hour: 10, minute: 10, second: 0, millisecond: 0 });
        const isLate = nowIST.isAfter(lateCutoff);


        // Create Date object using components
        const istDate = new Date(
            nowIST.year(),
            nowIST.month(),      // 0-based
            nowIST.date(),
            nowIST.hour(),
            nowIST.minute(),
            nowIST.second(),
            nowIST.millisecond()
        );

        console.log(istDate);
        let attendance = await Attendance.findOne({
            employeeId: user._id,
            date: { $gte: todayStartIST, $lte: todayEndIST }
        });


        if (!attendance) {
            attendance = new Attendance({
                employeeId: user._id,
                employeeName: user.name,
                department: user.department,
                profilePhoto: user.profilePicture || null,
                date: istDate,
                checkIn: nowIST.toISOString(),
                status: isLate ? "late" : "present"
            });
            await attendance.save();
        } else if (!attendance.checkIn) {
            attendance.checkIn = nowIST.toISOString();
            attendance.status = isLate ? "late" : "present";
            await attendance.save();
        } else {
            // Already checked in today; don't duplicate
            return res.status(200).json({
                status: "success",
                message: "Already checked in for today",
                token: token,
                user: userResponse
            });
        }

        // Return complete user details
        res.status(200).json({
            status: "success",
            message: "Login successful and check-in recorded!",
            token: token,
            user
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            status: "error",
            message: "Error during login",
            error: error.message
        });
    }
};

export const logout = async (req, res) => {
    try {
        const userId = req.user._id;
        let { checkOuttime } = req.body;

        console.log("Raw checkoutTime:", checkOuttime);

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        } 

        const todayStartIST = moment().tz("Asia/Kolkata").startOf('day').toDate();
        const todayEndIST   = moment().tz("Asia/Kolkata").endOf('day').toDate();

        let attendance = await Attendance.findOne({
            employeeId: userId,
            date: { $gte: todayStartIST, $lte: todayEndIST }
        });

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance is Empty!"
            });
        }

        // Prevent double checkout
        if (attendance.checkOut) {
            return res.status(200).json({
                status: "success",
                message: "Already checked out for today"
            });
        }

        // Determine checkout time (prefer provided, fallback to now)
        let checkoutDate = checkOuttime
            ? moment(checkOuttime).tz("Asia/Kolkata")
            : moment().tz("Asia/Kolkata");
        if (!checkoutDate.isValid()) {
            return res.status(400).json({ status: "error", message: "Invalid checkout time received!" });
        }
        attendance.checkOut = checkoutDate.toISOString();
        
        

        console.log("Checkout stored:", attendance.checkOut);

        // Compute hoursWorked
        if (attendance.checkIn && attendance.checkOut) {
            const hours = (new Date(attendance.checkOut) - new Date(attendance.checkIn)) / 36e5;
            attendance.hoursWorked = hours > 0 ? hours : 0;
            attendance.status = attendance.status || "present";
        }

        await attendance.save();

        if (user.token) {
            // user.token = null;
            await user.save();
        }

        res.status(200).json({
            status: "success",
            message: "Logout successful & check-out recorded!!!"
        });

    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            status: "error",
            message: "Error during logout"
        });
    }
};
export const getUserProfile = async (req, res) => {
    try {
        // Get user from authenticated request
        const userId = req.user._id;

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        const dobDate = parseFlexibleDate(userResponse.dob);
        const formattedDob = dobDate ? dobDate.toISOString() : null;

        // Return complete user details
        res.status(200).json({
            status: "success",
            message: "Profile retrieved successfully",
            user: {
                // Basic Info
                _id: userResponse._id,
                username: userResponse.username,
                role: userResponse.role,

                // Status Flags
                isAdmin: userResponse.isAdmin,
                isManager: userResponse.isManager,
                isHR: userResponse.isHR,
                isEmployee: userResponse.isEmployee,
                isActive: userResponse.isActive,

                // Personal Information
                name: userResponse.name,
                email: userResponse.email,
                phone: userResponse.phone,
                address: userResponse.address,
                city: userResponse.city,
                state: userResponse.state,
                zip: userResponse.zip,
                country: userResponse.country,
                dob: formattedDob,
                gender: userResponse.gender,
                profilePicture: userResponse.profilePicture,

                // Employment Information
                employeeId: userResponse.employeeId,
                joiningDate: userResponse.joiningDate,
                salary: userResponse.salary,
                experience: userResponse.experience,
                education: userResponse.education,

                // Bank Information
                bankName: userResponse.bankName,
                bankAccountNumber: userResponse.bankAccountNumber,
                bankAccountType: userResponse.bankAccountType,
                bankIFSC: userResponse.bankIFSC,
                bankAccountHolderName: userResponse.bankAccountHolderName,

                // Work Details
                department: userResponse.department,
                designation: userResponse.designation,

                // Additional Fields
                skills: userResponse.skills,
                certifications: userResponse.certifications,
                achievements: userResponse.achievements,
                notes: userResponse.notes,
                lastLogin: userResponse.lastLogin,

                // Timestamps
                createdAt: userResponse.createdAt,
                updatedAt: userResponse.updatedAt
            }
        });

    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            status: "error",
            message: "Error retrieving profile",
            error: error.message
        });
    }
};