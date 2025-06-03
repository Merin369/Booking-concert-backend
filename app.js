const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const MongoStore = require("connect-mongo");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./database/db"); // ✅ Corrected path
const { isAuthenticated, isAdminAuthenticated } = require("./middleware/auth");

// ✅ Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/concertDB";

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ✅ Enable CORS for frontend
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

// ✅ Set views directory and engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ✅ Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "concert_booking_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// ✅ Flash messages
app.use(flash());

// ✅ Global variables for views
app.use((req, res, next) => {
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  res.locals.user = req.session.user || null;
  console.log("Session Data:", req.session);
  next();
});

// ✅ Serve static files (e.g. tickets)
app.use("/tickets", express.static(path.join(__dirname, "public/tickets")));

// ✅ Load Routes
const userRoutes = require("./routes/users");
const concertRoutes = require("./routes/concerts");
const apiRoutes = require("./routes/api");

// ✅ Start server after DB connection
(async () => {
  await connectDB(); // ⬅️ Connect to MongoDB

  app.use("/users", userRoutes);
  app.use("/concerts", concertRoutes);
  app.use("/api", apiRoutes);

  app.use("/admin", isAdminAuthenticated, (req, res) => {
    res.render("admin/dashboard", { user: req.user });
  });

  app.use("/dashboard", isAuthenticated, (req, res) => {
    res.render("user/dashboard", { user: req.user });
  });

  app.get("/", (req, res) => res.redirect("/users/signup"));

  app.use((req, res, next) => {
    res.status(404).render("error", { message: "Page not found!" });
  });

  app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.stack);
    res.status(500).render("error", { message: "Something went wrong!" });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
})();
