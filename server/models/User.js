const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  hashedPassword: { type: String, default: null },
  entraOid: { type: String, sparse: true, default: null },
  oidcSub: { type: String, sparse: true, default: null },
  createdAt: { type: Date, default: Date.now },
});
schema.index({ tenantId: 1, email: 1 }, { unique: true });
module.exports = mongoose.model('User', schema);
