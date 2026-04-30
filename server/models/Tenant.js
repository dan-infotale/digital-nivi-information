const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Tenant', schema);
