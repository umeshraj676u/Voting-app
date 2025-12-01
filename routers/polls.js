// routes/polls.js
const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');

function requireLogin(req, res, next){
  if(!req.session.user){ req.flash('error','Login required'); return res.redirect('/auth/login'); }
  next();
}

// create form (admin or any logged user)
router.get('/create', requireLogin, (req, res) => res.render('create-poll'));

// create poll
router.post('/create', requireLogin, async (req, res) => {
  try {
    const { question, options, expiresAt } = req.body;
    // options can be newline separated
    const opts = (typeof options === 'string' ? options.split('\n') : options)
      .map(o => o.trim())
      .filter(o => o.length)
      .slice(0, 10); // max 10 options
    if(!question || opts.length < 2){ req.flash('error','Question and at least 2 options required'); return res.redirect('/polls/create'); }
    const optionsObj = opts.map(text => ({ text }));
    const poll = await Poll.create({
      question,
      options: optionsObj,
      createdBy: req.session.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    req.flash('success','Poll created');
    res.redirect(`/polls/${poll._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error','Could not create poll');
    res.redirect('/polls/create');
  }
});

// view poll + vote form
router.get('/:id', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id).lean();
    if(!poll) return res.status(404).send('Poll not found');
    // check if user voted
    let userVoted = null;
    if(req.session.user){
      const vote = await Vote.findOne({ poll: poll._id, user: req.session.user.id }).lean();
      if(vote) userVoted = vote.optionIndex;
    }
    res.render('poll', { poll, userVoted });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// cast vote
router.post('/:id/vote', requireLogin, async (req, res) => {
  try {
    const pollId = req.params.id;
    const optionIndex = parseInt(req.body.option);
    const poll = await Poll.findById(pollId);
    if(!poll){ req.flash('error','Invalid poll'); return res.redirect('/'); }
    // check expiry
    if(poll.expiresAt && poll.expiresAt < new Date()){ req.flash('error','Poll expired'); return res.redirect(`/polls/${pollId}`); }
    // Check if user already voted
    const already = await Vote.findOne({ poll: pollId, user: req.session.user.id });
    if(already){ req.flash('error','You already voted'); return res.redirect(`/polls/${pollId}`); }
    if(optionIndex < 0 || optionIndex >= poll.options.length){ req.flash('error','Invalid option'); return res.redirect(`/polls/${pollId}`); }
    // create vote and increment option count atomically
    await Vote.create({ poll: pollId, user: req.session.user.id, optionIndex });
    poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
    await poll.save();
    req.flash('success','Vote recorded');
    res.redirect(`/polls/${pollId}`);
  } catch (err) {
    console.error(err);
    if(err.code === 11000) { req.flash('error','Already voted'); return res.redirect(`/polls/${req.params.id}`); }
    req.flash('error','Could not record vote');
    res.redirect(`/polls/${req.params.id}`);
  }
});

// results page
router.get('/:id/results', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id).lean();
    if(!poll) return res.status(404).send('Poll not found');
    const total = poll.options.reduce((s,o)=>s+(o.votes||0),0);
    res.render('result', { poll, total });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
