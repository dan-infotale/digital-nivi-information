const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  apiUrl: { type: String, required: true },
  token: { type: String, required: true },
  phoneNumberId: { type: String, required: true },
  verifyToken: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('MetaConnection', schema);
