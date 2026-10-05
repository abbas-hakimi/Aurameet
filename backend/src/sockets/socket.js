import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";

import {
    registerMeetingSocket,
    removeSocketFromMeeting
} from "./meeting.socket.js";

import {
    registerChatSocket
} from "./chat.socket.js";


export const initializeSocket = (server, env) => {

    const io = new Server(server, {
        cors: {
            origin: env.clientUrl,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use(socketAuth);

    io.on("connection", (socket) => {
        socket.data.meetingCode = null;
        socket.data.waitingMeetingCode = null;
        socket.data.user = socket.user;
        socket.join(`user:${socket.user.id}`);

        console.log(
            `Socket connected: ${socket.id}`
        );

        registerMeetingSocket(io, socket);

        registerChatSocket(io, socket);

        socket.on("disconnect", () => {

            removeSocketFromMeeting(io, socket, true).catch((error) => {
                console.error("Socket disconnect cleanup failed:", error.message);
            });

            console.log(
                `Socket disconnected: ${socket.id}`
            );
        });
    });

    return io;
};
