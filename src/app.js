// responsible for configuring  express

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const app = express();
const PORT = process.env.PORT || 5000;
const authRoutes = require("./modules/auth/auth.routes");

// Middlewares
app.use(cors());
app.use(express.json());

const startServer =async () => {
    try{
        const connection = await pool.getConnection();

        console.log("MySQL connected successfully");

        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    }
    catch(error){
        console.error("Error connecting to MySQL:", error);
    }
}

app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Job Application API is running"
    });
});

startServer();
module.exports = app;