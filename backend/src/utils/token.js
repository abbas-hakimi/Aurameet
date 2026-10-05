import jwt from "jsonwebtoken";
import env from "../config/env.js";

export const generateAccessToken = (user) => {
    return jwt.sign(
        {
            sub: user._id.toString(),
            role: user.role
        },
        env.jwtAccessSecret,
        {
            expiresIn: "15m"
        }
    );
};

export const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            sub: user._id.toString()
        },
        env.jwtRefreshSecret,
        {
            expiresIn: "7d"
        }
    );
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(
        token,
        env.jwtRefreshSecret
    );
};