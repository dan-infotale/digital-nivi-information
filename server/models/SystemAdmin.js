const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  hashedPassword: { type: String, default: null },
  entraOid: { type: String, sparse: true, default: null },
  name: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('SystemAdmin', schema);
