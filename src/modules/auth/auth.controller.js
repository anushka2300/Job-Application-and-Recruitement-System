const authService = require("./auth.service");
const { generateToken } = require("../../utils/jwt");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    await authService.registerUser(name.trim(), email, password);
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: "CANDIDATE"
      },
    });
  } catch (error) {
    if (error.code === "EMAIL_ALREADY_REGISTERED") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Error registering user:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }
    const user = await authService.loginUser(email, password);
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user },
      token,
    });
  } catch (error) {
    if (error.code === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Error logging in user:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const profile = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

module.exports = {
  register,
  login,
  profile,
};
