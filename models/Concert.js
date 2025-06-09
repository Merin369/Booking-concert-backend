const mongoose = require("mongoose");

const concertSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true, lowercase: true },
    price: { type: Number, required: true, min: 0 },
    date: { 
      type: Date, 
      required: true,
      validate: {
        validator: function (value) {
          return value instanceof Date && !isNaN(value);
        },
        message: "Invalid date format",
      }
    },
    venue: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    availableTickets: { type: Number, required: true, min: 0 },
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Concert || mongoose.model("Concert", concertSchema);
