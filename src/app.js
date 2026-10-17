// responsible for configuring  express

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const app = express();
const authRoutes = require("./modules/auth/auth.routes");
const companyRoutes = require("./modules/company/company.routes");
const jobsRoutes = require("./modules/jobs/jobs.routes");
const applicationRoutes = require("./modules/applications/application.routes");

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api", applicationRoutes);

const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Job Application API is running",
  });
};

app.get("/health", healthCheck);
app.get("/api/health", healthCheck);
app.get("/integration_api",async (req, res) =>{
  try{
    console.log("Integration API is running");
    res.status(200).json({
      success: true,
      message: "Integration API is running",
    });
  }
  catch(error){
    console.error("Integration API check failed due to:", error);
    res.status(503).json({
      success: false,
      message: "Integration API is not running",
    });
  }
})

app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      success: true,
      status: "ready",
      checks: { database: "ok" },
    });
  } catch (error) {
    console.error("Database readiness check failed due to:", error);
    res.status(503).json({
      success: false,
      status: "not_ready",
      checks: { database: "unavailable" },
    });
  }
});

module.exports = app;
