import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        avatar: {
            type: String,
            default: ""
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        lastLogin: {
            type: Date
        },

        refreshToken: {
            type: String,
            default: null,
            select: false
        },
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

export default User;
