const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");;
const {isAdminAuthenticated } = require("../middleware/auth");
const User = require("../models/User");
const Concert = require("../models/Concert");
const Booking = require("../models/Booking");

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// Ensure the downloads directory exists
const downloadDirectory = path.join(__dirname, "../downloads");

if (!fs.existsSync(downloadDirectory)) {
  fs.mkdirSync(downloadDirectory, { recursive: true });
}
// ✅ Middleware for authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied, token required" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ✅ Admin Authentication
router.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ message: "Admin login successful", token });
  }
  res.status(401).json({ error: "Invalid admin credentials" });
});

// ✅ Create Concert (Admin Only)
router.post("/concerts", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

  try {
    const { name, location, price, date, venue, time, availableTickets } = req.body;
    const concert = new Concert({ name, location, price, date, venue, time, availableTickets });
    await concert.save();
    res.json({ message: "Concert added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error adding concert" });
  }
});

// ✅ Update Concert (Admin Only)
router.put("/concerts/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

  try {
    const concert = await Concert.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!concert) return res.status(404).json({ error: "Concert not found" });
    res.json(concert);
  } catch (err) {
    res.status(500).json({ error: "Error updating concert" });
  }
});

// ✅ Delete Concert (Admin Only)
router.delete("/concerts/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

  try {
    await Concert.findByIdAndDelete(req.params.id);
    res.json({ message: "Concert deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting concert" });
  }
});


// ✅ User Signup
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error registering user" });
  }
});

// ✅ User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

// ✅ Get All Concerts
router.get("/concerts", async (req, res) => {
  try {
    const concerts = await Concert.find();
    res.json(concerts);
  } catch (err) {
    res.status(500).json({ error: "Error fetching concerts" });
  }
});

// ✅ Book a Concert
router.post("/concerts/book/:id", authenticateToken, async (req, res) => {
  try {
    const { ticketQuantity } = req.body;
    const concert = await Concert.findById(req.params.id);

    if (!concert) return res.status(404).json({ error: "Concert not found" });

    if (ticketQuantity < 1 || ticketQuantity > 3) {
      return res.status(400).json({ error: "You can only book between 1 and 3 tickets." });
    }

    if (concert.availableTickets < ticketQuantity) {
      return res.status(400).json({ error: "Not enough tickets available." });
    }

    concert.availableTickets -= ticketQuantity;
    await concert.save();

    const booking = new Booking({
      userId: req.user.id, // ✅ FIXED: Using JWT token instead of session
      concertId: concert._id,
      ticketQuantity,
      date: new Date(),
    });
    await booking.save();

    res.status(201).json({ message: "Booking successful", booking });
  } catch (err) {
    console.error("Error processing booking:", err);
    res.status(500).json({ error: "Error processing your booking." });
  }
});

// ✅ Fetch all bookings (Admin only)
router.get("/admin/bookings", isAdminAuthenticated, async (req, res) => {
  try {
    const bookings = await Booking.find().populate("userId", "username email");

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ error: "No bookings found" });
    }

    const formattedBookings = bookings.map((booking) => ({
      _id: booking._id, 
      userId: booking.userId._id,
      username: booking.userId.username,
      tickets: booking.ticketQuantity,
      bookingDate: booking.date ? new Date(booking.date).toLocaleString() : "N/A",
    }));

    res.status(200).json(formattedBookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Cancel a booking (Admin only)
router.delete("/admin/cancel-booking/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    
    console.log("Received delete request for booking ID:", bookingId); 

    // ✅ Validate Booking ID format
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    // ✅ Check if booking exists before deletion
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // ✅ Delete booking
    await Booking.findByIdAndDelete(bookingId);

    res.status(200).json({ success: true, message: "Booking canceled successfully" });
  } catch (error) {
    console.error("Error canceling booking:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// ✅ Generate QR Code for Booking
router.get("/qr/:concertId/:ticketQuantity", async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) return res.status(404).json({ error: "Concert not found" });

    const ticketQuantity = req.params.ticketQuantity;

    // Generate QR Code with Booking Details
    const qrData = `Concert: ${concert.name}, Tickets: ${ticketQuantity}, Price: ${concert.price * ticketQuantity}`;
    const qrCode = await QRCode.toDataURL(qrData);

    res.json({ concert, ticketQuantity, qrCode });

  } catch (error) {
    console.error("Error generating QR Code:", error);
    res.status(500).json({ error: "Error generating QR Code" });
  }
});

// ✅ Generate PDF Ticket with QR Code
router.post("/qr/pdf/:concertId/:ticketQuantity", authenticateToken, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) return res.status(404).json({ error: "Concert not found" });

    const ticketQuantity = req.params.ticketQuantity;
    const userId = req.user.id; 

    const qrData = `Concert: ${concert.name}, Tickets: ${ticketQuantity}, Price: ${concert.price * ticketQuantity}`;

    // Generate QR Code Image
    const qrCodePath = path.join(downloadDirectory, `qrcode_${concert._id}.png`);
    await QRCode.toFile(qrCodePath, qrData);

    // Create PDF File
    const pdfFileName = `ticket_${concert._id}_${userId}.pdf`;
    const pdfPath = path.join(downloadDirectory, pdfFileName);
    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(pdfPath);

    doc.pipe(pdfStream);
    doc.fontSize(20).text(`Concert Ticket`, { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Concert Name: ${concert.name}`);
    doc.text(`Location: ${concert.location}`);
    doc.text(`Date: ${concert.date}`);
    doc.text(`Time: ${concert.time}`);
    doc.text(`Tickets: ${ticketQuantity}`);
    doc.text(`Total Price: $${concert.price * ticketQuantity}`);
    doc.moveDown();
    
    // Add QR Code Image to PDF
    doc.image(qrCodePath, { fit: [150, 150], align: "center" });

    doc.end();

    // Wait for PDF to finish writing
    pdfStream.on("finish", async () => {
      // Save Booking with PDF Path
      const booking = new Booking({
        userId,
        concertId: concert._id,
        ticketQuantity,
        pdfPath, 
      });

      await booking.save();

      res.download(pdfPath, pdfFileName); 
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Error generating PDF ticket" });
  }
});

// ✅ Download Existing PDF Ticket
router.get("/download/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (!fs.existsSync(booking.pdfPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(booking.pdfPath);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Error downloading ticket" });
  }
});

module.exports = router;
