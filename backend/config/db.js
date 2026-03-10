const mongoose = require('mongoose');

const validateEnv = () => {
  const required = ['MONGO_URI', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
};

const connectDB = async () => {
  validateEnv();
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;