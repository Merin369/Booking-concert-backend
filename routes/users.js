const express = require("express");
const bcrypt = require("bcrypt"); // Use bcrypt for password hashing
const User = require("../models/User");

const router = express.Router();

// Hardcoded admin credentials
const adminUsername = "admin";
const adminPassword = "admin123"; // In production, you should hash passwords!

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  // Save the attempted URL in the session to redirect after login
  req.session.returnTo = req.originalUrl;
  res.redirect("/users/login");
}

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  res.redirect("/users/login");
}

// Admin login route
router.get("/admin/login", (req, res) => {
  res.render("admin-login", { message: req.flash("error") });
});

// Handle admin login
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  // Check if the admin credentials match
  if (username === adminUsername && password === adminPassword) {
    req.session.user = {
      username,
      role: "admin", // Admin role
    };
    return res.redirect("/concerts"); // Redirect to concert management page
  }

  // If invalid credentials
  req.flash("error", "Invalid admin credentials");
  res.redirect("/users/admin/login"); // Redirect back to the login page
});

// Render signup page (for regular users)
router.get("/signup", (req, res) => {
  res.render("signup", { message: req.flash("error") });
});

router.post("/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render("signup", { message: "Passwords do not match." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });

    await user.save();
    req.flash("success", "Registered successfully! Please login.");
    res.redirect("/users/login");
  } catch (err) {
    console.error("Signup Error:", err);
    if (err.code === 11000) {
      res.render("signup", { message: "Email already exists." });
    } else {
      res.render("signup", { message: "An error occurred. Please try again." });
    }
  }
});

// Render login page for regular users
router.get("/login", (req, res) => {
  res.render("login", { message: req.flash("error") });
});

// Handle regular user login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      req.session.user = user;

      // Redirect to the originally attempted page, or default to the booking page
      const redirectTo = req.session.returnTo || "/concerts/bookings"; // Fallback to '/bookings'
      delete req.session.returnTo; // Clear the saved URL after redirecting
      res.redirect(redirectTo);
    } else {
      req.flash("error", "Invalid email or password.");
      res.redirect("/users/login");
    }
  } catch (err) {
    req.flash("error", "An error occurred.");
    res.redirect("/users/login");
  }
});

// Handle user logout
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/users/login");
});



module.exports = router;
