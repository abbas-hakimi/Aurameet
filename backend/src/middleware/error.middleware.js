export const errorHandler = (
    err,
    req,
    res,
    next
) => {
    let statusCode = err.statusCode || 500;
    let message = statusCode < 500 ? err.message : "Internal server error";
    if (err?.code === 11000) {
        statusCode = 409;
        message = "A record with that value already exists";
    } else if (err?.name === "CastError" || err?.name === "ValidationError") {
        statusCode = 400;
        message = "Invalid request data";
    } else if (err?.type === "entity.parse.failed") {
        statusCode = 400;
        message = "Invalid JSON request body";
    } else if (err?.type === "entity.too.large") {
        statusCode = 413;
        message = "Request body is too large";
    }
    if (statusCode >= 500) console.error(err);

    res.status(statusCode).json({
        success: false,
        message
    });
};
