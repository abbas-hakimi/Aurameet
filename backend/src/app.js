import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { initializeSocket } from "./sockets/socket.js";
import env from "./config/env.js";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import {
    errorHandler
} from "./middleware/error.middleware.js";

const app = express();
const server = createServer(app);
const io = initializeSocket(server, env);
app.set("io", io);

// --------------------
// Middleware
// --------------------

const allowedClientOrigins = new Set([env.clientUrl, "http://localhost:5173", "http://127.0.0.1:5173"]);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedClientOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => { req.body ??= {}; next(); });


//routes
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

// --------------------
// Test route
// --------------------

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "AuraMeet API is running"
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});
app.use(errorHandler);

// --------------------
// Start server
// --------------------

const startServer = async () => {
    await connectDB();

    server.listen(env.port, () => {
        console.log(`AuraMeet server running on port ${env.port}`);
    });
};

startServer();

