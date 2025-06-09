const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// ✅ Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied, token required" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // Attach user data to request
    next();
  });
};

// ✅ Middleware to check if the user is an admin
const isAdminAuthenticated = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied, token required" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });

    if (user.role !== "admin") {
      console.warn(`Unauthorized access attempt: ${req.originalUrl}`);
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    req.user = user; // Attach user data to request
    next();
  });
};

module.exports = { isAuthenticated, isAdminAuthenticated };
