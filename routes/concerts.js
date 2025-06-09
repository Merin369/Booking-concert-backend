const express = require("express");
const Concert = require("../models/Concert");
const Booking = require("../models/Booking");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const {  isAdminAuthenticated } = require("../middleware/auth");


const router = express.Router();

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/users/login");
}

// Ensure the downloads directory exists for PDF storage
const downloadDirectory = path.join(__dirname, "../downloads");
if (!fs.existsSync(downloadDirectory)) {
  fs.mkdirSync(downloadDirectory, { recursive: true });
}

// ================================
//        CONCERT ROUTES
// ================================

// Display all concerts with booking details
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const concerts = await Concert.find();
    const bookings = await Booking.find();
    res.render("concerts", { concerts, bookings });
  } catch (err) {
    console.error("Error fetching concerts and bookings:", err);
    res.status(500).send("Server Error");
  }
});

// Route to show the concert creation form
router.get("/create_concert", isAuthenticated, (req, res) => {
  res.render("add-concert", { message: req.flash("error") });
});

// Create a new concert (Admin only)
router.post("/create", isAuthenticated, async (req, res) => {
  try {
    const { name, location, price, date, venue, time, availableTickets } = req.body;

    if (!name || !location || !price || !date || !availableTickets) {
      req.flash("error", "All required fields must be filled!");
      return res.redirect("/concerts");
    }

    const newConcert = new Concert({ name, location, price, date, venue, time, availableTickets });
    await newConcert.save();
    req.flash("success", "Concert added successfully!");
    res.redirect("/concerts");
  } catch (err) {
    req.flash("error", "Error adding concert.");
    res.redirect("/concerts");
  }
});

// Delete a concert (Admin only)
router.post("/delete/:id", isAuthenticated, async (req, res) => {
  try {
    await Concert.findByIdAndDelete(req.params.id);
    res.redirect("/concerts");
  } catch (err) {
    res.status(400).send("Error deleting concert");
  }
});

// Display concert edit form
router.get("/edit/:id", isAuthenticated, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) {
      req.flash("error", "Concert not found.");
      return res.redirect("/concerts");
    }
    res.render("updateConcert", { concert });
  } catch (error) {
    console.error("Error fetching concert:", error);
    req.flash("error", "Error loading concert.");
    res.redirect("/concerts");
  }
});

// Update concert
router.post("/:id/update", isAuthenticated, async (req, res) => {
  try {
    const { name, location, price, date, venue, time, availableTickets } = req.body;

    const formattedDate = new Date(date);
    const updatedConcert = await Concert.findByIdAndUpdate(
      req.params.id,
      { name, location, price, date: formattedDate, venue, time, availableTickets },
      { new: true, runValidators: true }
    );

    if (!updatedConcert) {
      req.flash("error", "Concert not found.");
      return res.redirect("/concerts");
    }

    req.flash("success", "Concert updated successfully!");
    res.redirect("/concerts");
  } catch (err) {
    console.error("Error updating concert:", err);
    req.flash("error", "Something went wrong! Please try again later.");
    res.redirect(`/concerts/${req.params.id}/edit`);
  }
});

// ================================
//        BOOKING ROUTES
// ================================

// Display concerts for booking
// ✅ Display concerts for booking
router.get("/bookings", isAuthenticated, async (req, res) => {
  try {
    const concerts = await Concert.find();
    res.render("booking-page", { concerts });
  } catch (err) {
    res.status(500).send("Error fetching concerts for booking.");
  }
});

// ✅ Cancel a booking (Admin only)
router.post("/cancel-booking/:id", async (req, res) => {
  try {
      const bookingId = req.params.id;
      const deletedBooking = await Booking.findByIdAndDelete(bookingId);

      if (!deletedBooking) {
          return res.status(404).json({ message: "Booking not found" });
      }

      res.redirect("/concerts"); // Redirect back to concerts page after cancellation
  } catch (error) {
      console.error("Error canceling booking:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

// Handle ticket booking
router.post("/confirm-payment/:id", isAuthenticated, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) return res.status(404).send("Concert not found");

    const { ticketQuantity } = req.body;

    if (concert.availableTickets < ticketQuantity) {
      req.flash("error", "Not enough tickets available.");
      return res.redirect(`/concerts/payment/${concert._id}`);
    }

    concert.availableTickets -= ticketQuantity;
    const booking = new Booking({ userId: req.session.user._id, concertId: concert._id, ticketQuantity, date: new Date() });

    await booking.save();
    await concert.save();

    res.redirect(`/concerts/qr/${concert._id}/${ticketQuantity}`);
  } catch (err) {
    console.error("Error processing booking:", err);
    req.flash("error", "Error processing your booking.");
    res.redirect(`/concerts/payment/${req.params.id}`);
  }
});

// ================================
//        PAYMENT ROUTES
// ================================

router.get("/payment/:concertId", isAuthenticated, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) return res.status(404).send("Concert not found");

    res.render("payment-form", { concert });
  } catch (err) {
    console.error("Error loading payment page:", err);
    req.flash("error", "Error loading payment page.");
    res.redirect("/concerts/bookings");
  }
});

// ================================
//       QR CODE & PDF ROUTES
// ================================

// Generate QR Code for Booking
router.get("/qr/:concertId/:ticketQuantity", async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) return res.status(404).send("Concert not found");

    const ticketQuantity = req.params.ticketQuantity;
    const qrData = `Concert: ${concert.name}, Tickets: ${ticketQuantity}, Price: ${concert.price * ticketQuantity}`;
    const qrCode = await QRCode.toDataURL(qrData);

    res.render("qr", { concert, ticketQuantity, qrCode });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating QR code");
  }
});

// Generate and Download PDF Ticket
router.post("/qr/pdf/:concertId/:ticketQuantity", async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.concertId);
    if (!concert) return res.status(404).send("Concert not found");

    const userId = req.session.user ? req.session.user._id : "Guest"; // Get user ID if logged in
    const ticketQuantity = parseInt(req.params.ticketQuantity, 10);

    // Format Date Properly
    const formattedDate = new Date(concert.date).toLocaleDateString();

    // Generate QR Code with Booking Details
    const qrData = `Concert: ${concert.name}, Tickets: ${ticketQuantity}, Price: ${concert.price * ticketQuantity}, Date: ${formattedDate}`;
    const qrCodePath = path.join(downloadDirectory, `qrcode_${concert._id}.png`);
    await QRCode.toFile(qrCodePath, qrData);

    // Define PDF Path
    const pdfFileName = `ticket_${concert._id}_${userId}.pdf`;
    const pdfPath = path.join(downloadDirectory, pdfFileName);

    // Create PDF Document
    const doc = new PDFDocument({ margin: 50 });
    const pdfStream = fs.createWriteStream(pdfPath);
    doc.pipe(pdfStream);

    // PDF Content
    doc.fontSize(20).text(`Concert Ticket`, { align: "center" }).moveDown();
    doc.fontSize(16).text(`Concert Name: ${concert.name}`);
    doc.text(`Location: ${concert.location}`);
    doc.text(`Date: ${formattedDate}`);
    doc.text(`Time: ${concert.time}`);
    doc.text(`Tickets: ${ticketQuantity}`);
    doc.text(`Total Price: $${concert.price * ticketQuantity}`).moveDown();

    // Add QR Code Image
    doc.image(qrCodePath, { fit: [150, 150], align: "center" });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be ready, then download
    pdfStream.on("finish", async () => {
      if (fs.existsSync(pdfPath)) {
        res.download(pdfPath, pdfFileName);
      } else {
        res.status(500).send("Error generating PDF ticket.");
      }
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating PDF ticket");
  }
});


module.exports = router;
