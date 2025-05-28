const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  concertId: { type: mongoose.Schema.Types.ObjectId, ref: "Concert", required: true },
  ticketQuantity: { type: Number, required: true },
  date: { type: Date, default: Date.now }, // ✅ Ensure it's a Date type
  pdfPath: { type: String } // Optional field for storing the ticket PDF path
});

module.exports = mongoose.model("Booking", BookingSchema);
