const express = require("express");
const router = express.Router();

// Middleware to check if the user is an authenticated admin
function isAdminAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.role === "admin") {
        return next();  // Allow access if the user is logged in and is an admin
    }
    console.warn("Unauthorized access attempt by non-admin user:", req.originalUrl);
    return res.status(403).json({ error: "Access denied. Admins only." });
}

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next(); // User is authenticated, proceed
    }
    console.warn("Unauthorized access attempt:", req.originalUrl);
    return res.status(401).json({ error: "Unauthorized. Please log in." });
}

module.exports = { isAuthenticated, isAdminAuthenticated };