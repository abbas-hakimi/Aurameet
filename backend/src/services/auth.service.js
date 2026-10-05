import bcrypt from "bcrypt";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} from "../utils/token.js";

export const registerUser = async ({ name, username, password }) => {

    name = name.trim();
    username = username.trim().toLowerCase();

    const existingUser = await User.findOne({ username });

    if (existingUser) {
        throw new AppError("Username already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        username,
        password: hashedPassword
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return {
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            role: user.role
        },
        accessToken,
        refreshToken
    };
};


export const loginUser = async ({ username, password }) => {

    username = username.trim().toLowerCase();
    const user = await User.findOne({ username }).select("+password +refreshToken");

    if (!user) {
        throw new AppError("Invalid username or password", 401);
    }

    const passwordMatched = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatched) {
        throw new AppError("Invalid username or password", 401);
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return {
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            role: user.role
        },
        accessToken,
        refreshToken
    };
};

export const refreshAccessToken = async (refreshToken) => {
    let decoded;
    try { decoded = verifyRefreshToken(refreshToken); }
    catch { throw new AppError("Invalid or expired refresh token", 401); }

    const user = await User.findById(decoded.sub).select("+refreshToken");

    if (!user) {
        throw new AppError("Invalid or expired refresh token", 401);
    }

    if (user.refreshToken !== refreshToken) throw new AppError("Invalid refresh token", 401);

    const accessToken = generateAccessToken(user);

    return accessToken;
};

export const logoutUser = async (refreshToken) => {
    try {
        const decoded = verifyRefreshToken(refreshToken);

        const user = await User.findById(decoded.sub).select("+refreshToken");

        if (user && user.refreshToken === refreshToken) {
            user.refreshToken = null;
            await user.save();
        }
    } catch {
        // Token is already invalid/expired
    }
};
