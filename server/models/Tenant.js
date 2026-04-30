const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  oidc: {
    enabled: { type: Boolean, default: false },
    discoveryUrl: { type: String, default: '' },
    clientId: { type: String, default: '' },
    clientSecret: { type: String, default: '' },
    label: { type: String, default: 'SSO' },
  },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Tenant', schema);
