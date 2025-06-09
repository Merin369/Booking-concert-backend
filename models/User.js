const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: [true, "Username is required"] },
  email: { 
    type: String, 
    required: [true, "Email is required"], 
    unique: true, 
    match: [/.+\@.+\..+/, 'Please enter a valid email address']  
  },
  password: { type: String, required: [true, "Password is required"] },
  isAdmin: { type: Boolean, default: false }
});


const User = mongoose.model("User", userSchema);
module.exports = User;
