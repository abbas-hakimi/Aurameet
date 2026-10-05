import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";

export const socketAuth = async (socket, next) => {

    try {

        const token =
            socket.handshake.auth?.token;

        if (!token) {
            return next(
                new Error("Authentication required")
            );
        }

        const decoded = jwt.verify(
            token,
            env.jwtAccessSecret
        );

        const user = await User.findById(
            decoded.sub
        );

        if (!user) {
            return next(
                new Error("User not found")
            );
        }

        socket.user = {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            role: user.role
        };

        next();

    } catch (error) {

        next(
            new Error("Invalid or expired access token")
        );
    }
};
