const mongoose = require("mongoose");

const concertSchema = new mongoose.Schema({
  name: String,
  location: String,
  price: Number,
  date: Date,
  venue: String,
  time: String,
  availableTickets: Number,
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
});

// Check if model is already defined before defining it
module.exports = mongoose.models.Concert || mongoose.model("Concert", concertSchema);
