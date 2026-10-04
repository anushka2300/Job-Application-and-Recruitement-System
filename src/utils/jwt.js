const jwt = require("jsonwebtoken");

const generateToken = (user) => {

    return jwt.sign(
        {
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
};
//HEADER.PAYLOAD.SIGNATURE = JWT TOKEN
// HEADER + PAYLOAD + SECRET_KEY -> SHA256 -> SIGNATURE 


const verifyToken = (token) => {

    return jwt.verify(
        token,
        process.env.JWT_SECRET
    );
};


module.exports = {
    generateToken,
    verifyToken
};