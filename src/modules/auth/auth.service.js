const bcrypt = require("bcrypt");
const pool = require("../../config/db");

const registerUser = async (name, email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const [existingUsers] = await pool.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [normalizedEmail]
    );

    if (existingUsers.length > 0) {
        const error = new Error("Email is already registered");
        error.code = "EMAIL_ALREADY_REGISTERED";
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
        const [result] = await pool.execute(
            `
            INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)
            `,
            [name, normalizedEmail, hashedPassword]
        );

        return result;
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            const registrationError = new Error("Email is already registered");
            registrationError.code = "EMAIL_ALREADY_REGISTERED";
            throw registrationError;
        }

        throw error;
    }
};

const loginUser = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.execute(
        `
        SELECT id, name, email, password, role
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [normalizedEmail]
    );

    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
        const error = new Error("Invalid email or password");
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };
};

module.exports = {
    registerUser,
    loginUser
};