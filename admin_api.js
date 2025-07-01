// Load environment variables (Render sets them automatically, but dotenv is useful for local dev)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const app = express();
app.use(cors()); // Allow requests from your admin panel
app.use(express.json());

// Get all users (paginated)
app.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 100;
  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage,
  });
  console.log('Supabase listUsers data:', data); // Debug log
  if (error) return res.status(400).json({ error: error.message });
  res.json({ users: data?.users || [] });
});

// Change password for a user
app.post('/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword required' });
  }
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, user: data.user });
});

// Change password for a user by email (for automated reset)
app.post('/reset-password-by-email', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'email and newPassword required' });
  }
  // Find user by email
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) return res.status(400).json({ error: error.message });
  const user = data.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Update password
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updateError) return res.status(400).json({ error: updateError.message });
  res.json({ success: true, user: updateData.user });
});

// Manual password reset by email (for frontend direct use)
app.post('/manual-password-reset', async (req, res) => {
  const { email, newPassword } = req.body;
  console.log('Manual password reset request:', { email });
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'email and newPassword required' });
  }
  // Find user by email
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
  const user = data.users.find(u => u.email === email);
  if (!user) {
    console.error('User not found for email:', email);
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  // Update password
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updateError) {
    console.error('Error updating password:', updateError);
    return res.status(400).json({ success: false, message: updateError.message });
  }
  console.log('Password updated for user:', email);
  res.json({ success: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Super Admin API running on port ${PORT}`);
  console.log('Supabase URL:', SUPABASE_URL);
});

// Usage:
// 1. Set SUPABASE_URL and SERVICE_ROLE_KEY as environment variables (in .env or Render dashboard).
// 2. Run: npm install express cors @supabase/supabase-js
// 3. Start: node admin_api.js 