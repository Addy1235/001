const { z } = require('zod');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/jwt');
const { success, created, error, unauthorized, notFound } = require('../utils/response');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100)
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
});

// Register new user
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return error(res, 'Email already registered', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.email);
    const refreshToken = generateRefreshToken();

    // Store hashed refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return created(res, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      accessToken,
      refreshToken
    }, 'Registration successful');
  } catch (err) {
    next(err);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return unauthorized(res, 'Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return unauthorized(res, 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.email);
    const refreshToken = generateRefreshToken();

    // Store hashed refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return success(res, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        streak: user.streak,
        settings: user.settings
      },
      accessToken,
      refreshToken
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// Refresh access token
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, 'Refresh token is required', 400);
    }

    // Find user by hashed refresh token
    const tokenHash = hashToken(refreshToken);
    const user = await User.findOne({ refreshTokenHash: tokenHash });

    if (!user) {
      return unauthorized(res, 'Invalid refresh token');
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id, user.email);

    // Optionally rotate refresh token
    const newRefreshToken = generateRefreshToken();
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    return success(res, {
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    next(err);
  }
};

// Logout (invalidate refresh token)
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      refreshTokenHash: null
    });

    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

// Get current user profile
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -refreshTokenHash');

    if (!user) {
      return notFound(res, 'User not found');
    }

    return success(res, {
      id: user._id,
      email: user.email,
      name: user.name,
      streak: user.streak,
      settings: user.settings,
      lastSyncAt: user.lastSyncAt
    });
  } catch (err) {
    next(err);
  }
};

// Update user profile
exports.updateMe = async (req, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      settings: z.object({
        defaultLanguage: z.string().optional(),
        theme: z.enum(['light', 'dark']).optional(),
        ttsEnabled: z.boolean().optional()
      }).optional()
    });

    const data = updateSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: data },
      { new: true }
    ).select('-passwordHash -refreshTokenHash');

    return success(res, {
      id: user._id,
      email: user.email,
      name: user.name,
      settings: user.settings
    });
  } catch (err) {
    next(err);
  }
};
