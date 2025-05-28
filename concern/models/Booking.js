const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User ", required: true },
  concertId: { type: mongoose.Schema.Types.ObjectId, ref: "Concert", required: true },
  ticketQuantity: { type: Number, required: true, min: 1, max: 3 },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["Confirmed", "Cancelled"], default: "Confirmed" },
  pdfPath: { type: String, trim: true }, // Trim removes unnecessary spaces
});

// Optional: Add index for performance
bookingSchema.index({ userId: 1, concertId: 1 });

module.exports = mongoose.model("Booking", bookingSchema);