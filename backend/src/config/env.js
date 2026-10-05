import dotenv from "dotenv";

dotenv.config();

const env = {
    port: process.env.PORT || 8000,

    mongoUri: process.env.MONGO_URI,

    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",

    clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
};

export default env;
