import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: { type: String, default: "" },
    department: { type: String, default: "" },
    profilePhoto: { type: String, default: null },
    date: { type: Date, required: true },
    checkIn: { type: String, default: null },
    checkOut: { type: String, default: null },
    hoursWorked: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ["present", "absent", "leave", "holiday", "late", "half-day", "weekend"], 
      default: "present" 
    }
});

// Ek employee ka ek din mein ek hi record
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Auto-populate employeeId with selected fields on common queries
const employeeSelect = "name email profilePicture employeeId department designation";
function autopopulateEmployee(next) {
  this.populate("employeeId", employeeSelect);
  next();
}

AttendanceSchema.pre("find", autopopulateEmployee);
AttendanceSchema.pre("findOne", autopopulateEmployee);
AttendanceSchema.pre("findById", autopopulateEmployee);
AttendanceSchema.pre("findOneAndUpdate", function(next) {
  this.populate("employeeId", employeeSelect);
  next();
});

const Attendance = mongoose.model("Attendance", AttendanceSchema);
export default Attendance;
