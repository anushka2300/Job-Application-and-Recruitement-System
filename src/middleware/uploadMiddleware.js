const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf" || !file.originalname.toLowerCase().endsWith(".pdf")) {
      const error = new Error("Resume must be a PDF file");
      error.code = "INVALID_FILE_TYPE";
      return callback(error);
    }
    return callback(null, true);
  },
});

const uploadResume = (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Resume must not exceed 5 MB",
      });
    }

    if (error.code === "INVALID_FILE_TYPE" || error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  });
};

module.exports = uploadResume;
