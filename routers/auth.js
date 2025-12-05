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
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    // If no users exist OR no admin exists, make this user admin
    const role = (totalUsers === 0 || adminCount === 0) ? 'admin' : 'user';
    const user = await User.create({ name, email, passwordHash, role });
    console.log(`New user created: ${email}, Role: ${user.role}, TotalUsers: ${totalUsers}, AdminCount: ${adminCount}`);
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    if(role === 'admin') {
      req.flash('success', `Signup successful! You are now ADMIN. You can create polls.`);
    } else {
      req.flash('success', 'Signup successful! You can now vote on polls.');
    }
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
    const { email, password, redirect } = req.body;
    const user = await User.findOne({ email });
    if(!user){ req.flash('error','Invalid credentials'); return res.redirect('/auth/login'); }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok){ req.flash('error','Invalid credentials'); return res.redirect('/auth/login'); }
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    req.flash('success','Logged in');
    res.redirect(redirect || '/');
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

// admin setup - makes first user admin if no admin exists
router.get('/setup-admin', async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if(adminCount > 0) {
      req.flash('error', 'Admin already exists');
      return res.redirect('/');
    }
    const firstUser = await User.findOne().sort({ createdAt: 1 });
    if(!firstUser) {
      req.flash('error', 'No users found. Please signup first.');
      return res.redirect('/auth/signup');
    }
    firstUser.role = 'admin';
    await firstUser.save();
    req.flash('success', `User "${firstUser.email}" is now admin. Please login again.`);
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not setup admin');
    res.redirect('/');
  }
});

// check admin status - shows current user role and all users with admin panel
router.get('/check-admin', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const allUsers = await User.find().select('name email role createdAt').sort({ createdAt: 1 }).lean();
    const currentUser = req.session.user || null;
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Panel</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
          .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .admin { color: green; font-weight: bold; }
          .user { color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f0f0f0; font-weight: bold; }
          tr:hover { background: #f9f9f9; }
          .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; font-size: 14px; }
          .btn:hover { background: #0056b3; }
          .btn-success { background: #28a745; }
          .btn-success:hover { background: #218838; }
          .btn-danger { background: #dc3545; }
          .btn-danger:hover { background: #c82333; }
          .btn-warning { background: #ffc107; color: #333; }
          .btn-warning:hover { background: #e0a800; }
          .login-form { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .form-group { margin-bottom: 15px; }
          .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
          .form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
          .role-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .role-admin { background: #d4edda; color: #155724; }
          .role-user { background: #d1ecf1; color: #0c5460; }
          .action-buttons { display: flex; gap: 5px; }
          .flash { padding: 10px; margin: 10px 0; border-radius: 4px; }
          .flash-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .flash-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Admin Panel</h1>
          
          ${!currentUser ? `
            <div class="login-form">
              <h3>🔑 Admin Login</h3>
              <form method="POST" action="/auth/login">
                <input type="hidden" name="redirect" value="/auth/check-admin">
                <div class="form-group">
                  <label>Email:</label>
                  <input type="email" name="email" required>
                </div>
                <div class="form-group">
                  <label>Password:</label>
                  <input type="password" name="password" required>
                </div>
                <button type="submit" class="btn">Login</button>
                <a href="/auth/login" class="btn" style="margin-left: 10px;">Go to Login Page</a>
              </form>
            </div>
          ` : ''}

          ${currentUser ? `
            <div class="info">
              <h3>👤 Current Session:</h3>
              <p><strong>Name:</strong> ${currentUser.name}</p>
              <p><strong>Email:</strong> ${currentUser.email}</p>
              <p><strong>Role:</strong> <span class="role-badge ${currentUser.role === 'admin' ? 'role-admin' : 'role-user'}">${currentUser.role || 'user'}</span></p>
              ${currentUser.role === 'admin' ? '<p style="color: green; font-weight: bold;">✅ You are ADMIN - You can manage users!</p>' : '<p style="color: orange;">⚠️ You are USER - Only admins can change roles</p>'}
            </div>
          ` : ''}

          <div class="info">
            <h3>📊 Database Statistics:</h3>
            <p><strong>Total Users:</strong> ${totalUsers}</p>
            <p><strong>Admin Count:</strong> ${adminCount}</p>
            <p><strong>Regular Users:</strong> ${totalUsers - adminCount}</p>
            ${adminCount === 0 ? '<p style="color: red; font-weight: bold;">⚠️ No admin found! Signup a new user to become admin.</p>' : ''}
          </div>

          <h3>👥 All Users in Database:</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
                ${isAdmin ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${allUsers.map(u => `
                <tr>
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role || 'user'}</span></td>
                  <td>${new Date(u.createdAt).toLocaleString()}</td>
                  ${isAdmin ? `
                    <td class="action-buttons">
                      ${u.role === 'admin' ? `
                        <form method="POST" action="/auth/change-role" style="display:inline;">
                          <input type="hidden" name="userId" value="${u._id}">
                          <input type="hidden" name="newRole" value="user">
                          <button type="submit" class="btn btn-warning" onclick="return confirm('Are you sure you want to remove admin from ${u.email}?')">Remove Admin</button>
                        </form>
                      ` : `
                        <form method="POST" action="/auth/change-role" style="display:inline;">
                          <input type="hidden" name="userId" value="${u._id}">
                          <input type="hidden" name="newRole" value="admin">
                          <button type="submit" class="btn btn-success" onclick="return confirm('Make ${u.email} an admin?')">Make Admin</button>
                        </form>
                      `}
                    </td>
                  ` : '<td>-</td>'}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px;">
            <a href="/" class="btn">← Back to Home</a>
            ${currentUser ? `
              <form method="POST" action="/auth/logout" style="display:inline; margin-left: 10px;">
                <button type="submit" class="btn btn-danger">Logout</button>
              </form>
            ` : ''}
            ${adminCount === 0 ? '<a href="/auth/setup-admin" class="btn btn-success" style="margin-left: 10px;">Setup Admin</a>' : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error checking admin status');
  }
});

// change user role (admin only)
router.post('/change-role', async (req, res) => {
  try {
    const currentUser = req.session.user;
    if(!currentUser || currentUser.role !== 'admin') {
      req.flash('error', 'Only admin can change roles');
      return res.redirect('/auth/check-admin');
    }

    const { userId, newRole } = req.body;
    if(!userId || !newRole || !['admin', 'user'].includes(newRole)) {
      req.flash('error', 'Invalid request');
      return res.redirect('/auth/check-admin');
    }

    const user = await User.findById(userId);
    if(!user) {
      req.flash('error', 'User not found');
      return res.redirect('/auth/check-admin');
    }

    // Prevent removing last admin
    if(newRole === 'user' && user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if(adminCount <= 1) {
        req.flash('error', 'Cannot remove last admin. At least one admin must exist.');
        return res.redirect('/auth/check-admin');
      }
    }

    user.role = newRole;
    await user.save();

    // Update session if current user's role changed
    if(user._id.toString() === currentUser.id) {
      req.session.user.role = newRole;
    }

    req.flash('success', `User "${user.email}" role changed to ${newRole}`);
    res.redirect('/auth/check-admin');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not change role');
    res.redirect('/auth/check-admin');
  }
});

module.exports = router;
