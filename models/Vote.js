// models/Vote.js
const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  optionIndex: { type: Number, required: true }
}, { timestamps: true });

voteSchema.index({ poll: 1, user: 1 }, { unique: true }); // one vote per poll per user

module.exports = mongoose.model('Vote', voteSchema);

