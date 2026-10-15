const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://santhosh:santhosh123@cluster0.mongodb.net/bawaal?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['fan', 'scout', 'athlete'], required: true },
  specializedSport: { type: String, default: null }, // Used by scouts
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  athleteName: { type: String, required: true },
  title: { type: String, required: true },
  sport: { type: String, required: true },
  videoUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

// Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role, specializedSport } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email is already registered' });
    }

    const newUser = new User({
      name,
      email,
      password,
      role,
      specializedSport: role === 'scout' ? specializedSport : null
    });

    await newUser.save();
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

// Create Post Endpoint (For Athletes)
app.post('/api/posts', async (req, res) => {
  try {
    const { athleteName, title, sport, videoUrl } = req.body;

    if (!athleteName || !title || !sport || !videoUrl) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const newPost = new Post({
      athleteName,
      title,
      sport,
      videoUrl
    });

    await newPost.save();
    res.status(201).json({ success: true, post: newPost });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// Dynamic Feed Endpoint
app.get('/api/feed', async (req, res) => {
  try {
    const { role, specializedSport, view } = req.query;

    let query = {};
    let activeFilter = 'Global Community Feed';

    if (role === 'scout' && specializedSport && view !== 'global') {
      query.sport = specializedSport;
      activeFilter = `Specialized Scout Feed: ${specializedSport}`;
    }

    const posts = await Post.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      activeFilter,
      posts
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));