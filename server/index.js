const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 🔥 IMPORTANT: Initialize Firebase Admin
require('./firebase');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('PeerSkill Hub API is running...');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
