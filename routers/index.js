// routes/index.js
const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// home - list polls
router.get('/', async (req, res) => {
  const polls = await Poll.find().sort({ createdAt: -1 }).lean();
  res.render('index', { polls });
});

module.exports = router;
