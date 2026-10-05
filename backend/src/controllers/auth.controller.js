import AppError from "../utils/AppError.js";
import { registerUser, loginUser, refreshAccessToken, logoutUser } from "../services/auth.service.js";
import env from "../config/env.js";

const REFRESH_COOKIE = "refreshToken";
const refreshCookieOptions = {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
};
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path
});

const validateCredentials = ({ name, username, password }, registering = false) => {
    if (registering && (typeof name !== "string" || !name.trim() || name.trim().length > 80)) throw new AppError("Name must be 1 to 80 characters", 400);
    if (typeof username !== "string" || !/^[a-z0-9_.]{3,30}$/i.test(username.trim())) throw new AppError("Username must be 3 to 30 letters, numbers, dots or underscores", 400);
    if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) throw new AppError("Password must be 8 to 72 bytes", 400);
};

export const register = async (req, res) => {
    validateCredentials(req.body, true);
    const data = await registerUser(req.body);
    const { refreshToken, ...responseData } = data;
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.status(201).json({ success: true, message: "Registration successful", data: responseData });
};
export const login = async (req, res) => {
    validateCredentials(req.body);
    const data = await loginUser(req.body);
    const { refreshToken, ...responseData } = data;
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.json({ success: true, message: "Login successful", data: responseData });
};
export const getMe = (req, res) => res.json({ success: true, data: { user: req.user } });
export const refresh = async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken !== "string" || !refreshToken) throw new AppError("Refresh token required", 401);
    const accessToken = await refreshAccessToken(refreshToken);
    res.json({ success: true, data: { accessToken } });
};
export const logout = async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) await logoutUser(refreshToken);
    clearRefreshCookie(res);
    res.json({ success: true, message: "Logged out successfully" });
};
