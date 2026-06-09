import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import hrRouter from "./routes/hrRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import kraRoutes from "./routes/kraManagementRoutes.js";
import salaryRoutes from "./routes/salaryRoutes.js";

import cors from "cors";

const app = express();
dotenv.config();

const allowedOrigins = [
	"https://unifost-hrms-frontend.vercel.app",
	"https://unifost-hrms-frontend-typescript-lyart.vercel.app",
	"https://unifost-hrms-frontend-typescript.vercel.app",
	"http://localhost:3000"
  ];
  
  app.use(cors({
	origin: function(origin, callback){
	  // allow requests with no origin (like mobile apps, curl)
	  if(!origin) return callback(null, true);
	  if(allowedOrigins.indexOf(origin) === -1){
		const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
		return callback(new Error(msg), false);
	  }
	  return callback(null, true);
	},
	credentials: true
  }));
  

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/hr", hrRouter);
app.use("/api/announcement", announcementRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/kra", kraRoutes);
app.use("/api/salary", salaryRoutes);

app.get('/', (req, res) => {
	res.send("Hello World by hrms backend Brishbhan Singh Bhadoriya ");
});

// Start server with fallback port
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});


// Connect to database
connectDB();