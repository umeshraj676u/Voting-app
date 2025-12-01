// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');

function redirectIfAuth(req, res, next){
  if(req.session.user) return res.redirect('/');
  next();
}

// signup
router.get('/signup', redirectIfAuth, (req, res) => res.render('signup'));
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if(!name||!email||!password) { req.flash('error','All fields required'); return res.redirect('/auth/signup'); }
    const exists = await User.findOne({ email });
    if(exists){ req.flash('error','Email already registered'); return res.redirect('/auth/signup'); }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email, passwordHash });
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    req.flash('success','Signup successful');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error','Something went wrong');
    res.redirect('/auth/signup');
  }
});

// login
router.get('/login', redirectIfAuth, (req, res) => res.render('login'));
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user){ req.flash('error','Invalid credentials'); return res.redirect('/auth/login'); }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok){ req.flash('error','Invalid credentials'); return res.redirect('/auth/login'); }
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    req.flash('success','Logged in');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error','Something went wrong');
    res.redirect('/auth/login');
  }
});

// logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
