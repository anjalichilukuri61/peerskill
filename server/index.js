const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

// 🔥 IMPORTANT: Initialize Firebase Admin
require('./firebase');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS with specific origins and methods
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Simple logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('PeerSkill Hub API is running...');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/uploads', require('./routes/uploads'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
