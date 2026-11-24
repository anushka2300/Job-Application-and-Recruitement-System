const adminService = require("./admin.service");

const getAdminStats = async (_req, res) => {
  try {
    const stats = await adminService.getAdminStats();
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats",
    });
  }
};

module.exports = {
  getAdminStats,
};
