const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const session = require("express-session");
const flash = require("connect-flash");
const MongoStore = require("connect-mongo");
const path = require("path");
const cors = require("cors");
const { isAuthenticated, isAdminAuthenticated } = require("./middleware/auth"); // Import middlewares

dotenv.config();
const app = express();

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ✅ Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000", // Allow frontend requests
    credentials: true, // Allow cookies & sessions
  })
);

// ✅ Set correct views directory
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ✅ Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "concert_booking_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/concertDB",
      collectionName: "sessions",
    }),
  })
);

// ✅ Flash middleware
app.use(flash());

// ✅ Store flash messages globally
app.use((req, res, next) => {
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

// ✅ Serve static files for tickets
app.use("/tickets", express.static(path.join(__dirname, "public/tickets")));

// ✅ Connect to MongoDB
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/concertDB", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB successfully!");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
})();

// Debug MongoDB connection
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err.message);
});

// ✅ Routes
const userRoutes = require("./routes/users");
const concertRoutes = require("./routes/concerts");
const apiRoutes = require("./routes/api");

app.use("/users", userRoutes);
app.use("/concerts", concertRoutes);
app.use("/api", apiRoutes);

// ✅ Default route
app.get("/", (req, res) => res.redirect("/users/signup"));

// ✅ Handle 404 (Not Found)
app.use((req, res, next) => {
  res.status(404).render("error", { message: "Page not found!" });
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).render("error", { message: "Something went wrong!" });
});

// ✅ Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));