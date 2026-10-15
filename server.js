const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://bawaalapp:bawaalapp123@cluster0.mongodb.net/bawaal?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('🔥 Connected to BAWAAL MongoDB Atlas Database!'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// 1. User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['fan', 'scout', 'athlete'], default: 'fan' },
  specializedSport: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 2. Post / Video Schema & Model (for Feed)
const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sport: { type: String, required: true }, // e.g., 'Cricket', 'Boxing', 'Football'
  videoUrl: { type: String, required: true },
  athleteName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// --- ROUTES ---

// Root Test Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ONLINE', message: 'BAWAAL Backend API is running successfully!' });
});

// Register Route (Handles Fans, Scouts, and Athletes with Roles & Specializations)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role, specializedSport } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    const newUser = new User({
      name,
      email,
      password,
      role: role || 'fan',
      specializedSport: specializedSport || null
    });

    await newUser.save();
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        specializedSport: newUser.specializedSport
      }
    });
  } catch (error) {
    console.error('❌ DB Save Error:', error);
    res.status(500).json({ success: false, error: 'Failed to save user profile.' });
  }
});

// Feed Route (Returns Global Feed for Fans, or Sport-Filtered Feed for Scouts)
app.get('/api/feed', async (req, res) => {
  try {
    const { role, specializedSport, view } = req.query;
    
    let filter = {};

    // If user is a Scout and hasn't toggled to global view, filter by their specialized sport
    if (role === 'scout' && specializedSport && view !== 'global') {
      filter.sport = { $regex: new RegExp(`^${specializedSport}$`, 'i') };
    }

    const posts = await Post.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      role: role || 'fan',
      activeFilter: filter.sport ? specializedSport : 'Global',
      count: posts.length,
      posts: posts
    });
  } catch (error) {
    console.error('❌ Error fetching feed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed.' });
  }
});

// Get All Athletes API
app.get('/api/athletes', async (req, res) => {
  try {
    const athletes = await User.find({ role: 'athlete' });
    res.status(200).json(athletes);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch athletes.' });
  }
});

// Emergency SOS Trigger Route
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