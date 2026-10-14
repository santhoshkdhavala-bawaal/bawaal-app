const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 🗄️ MongoDB Atlas Cloud Connection
const MONGO_URI = 'mongodb+srv://kingatharvan_db_user:Bawaal2026@cluster0.kczk9gc.mongodb.net/bawaal_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('⚡ Connected to BAWAAL MongoDB Atlas Database!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));

// 📝 User Schema Definition
const userSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['athlete', 'scout', 'fan'] },
  fullName: { type: String, required: true },
  handle: { type: String },
  sport: { type: String },
  organization: { type: String },
  medicalInfo: {
    bloodGroup: String,
    emergencyContact: String,
    allergies: String,
    clearanceStatus: String
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 1. Health Check Route
app.get('/', (req, res) => {
  res.send('⚡ BAWAAL Cyber-Arena Engine & Database Connected!');
});

// 2. Registration API Route (Saves to MongoDB Atlas)
app.post('/api/register', async (req, res) => {
  try {
    const { role, fullName, handle, sport, organization, medicalInfo } = req.body;

    if (!fullName || !role) {
      return res.status(400).json({ error: 'Role and Full Name are required.' });
    }

    const newUser = new User({
      role,
      fullName,
      handle,
      sport,
      organization,
      medicalInfo
    });

    await newUser.save();
    console.log('✅ New User Saved to MongoDB Atlas:', newUser);

    res.status(201).json({
      message: 'User registered and saved to database successfully!',
      user: newUser
    });
  } catch (error) {
    console.error('❌ DB Save Error:', error);
    res.status(500).json({ error: 'Failed to save user profile.' });
  }
});

// 3. Get All Athletes API
app.get('/api/athletes', async (req, res) => {
  try {
    const athletes = await User.find({ role: 'athlete' });
    res.status(200).json(athletes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch athletes.' });
  }
});

// 4. Emergency SOS Trigger Route
app.post('/api/sos', (req, res) => {
  const { athleteId, location } = req.body;
  console.log(`🚨 SOS DISPATCH TRIGGERED FOR ATHLETE: ${athleteId || 'UNKNOWN'}`);
  
  res.status(200).json({
    status: 'DISPATCHED',
    message: 'Emergency command notified successfully.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 BAWAAL Server running on http://localhost:${PORT}`);
});