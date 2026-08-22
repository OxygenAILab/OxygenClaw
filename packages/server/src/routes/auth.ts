import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, runInsert, runExec } from '../services/db';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, username and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const existingEmail = runQuery('SELECT id FROM users WHERE email = ?', [email])[0];
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const existingUsername = runQuery('SELECT id FROM users WHERE username = ?', [username])[0];
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken'
      });
    }

    const userId = uuidv4();
    const oxygenId = `oxygen-${uuidv4().slice(0, 12)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    runInsert(`
      INSERT INTO users (id, email, username, password_hash, oxygen_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, email.toLowerCase(), username, passwordHash, oxygenId, now, now]);

    const token = generateToken(userId);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          email: email.toLowerCase(),
          username,
          oxygenId,
          createdAt: now
        }
      }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, username, emailOrUsername, password } = req.body;
    const login = emailOrUsername || email || username;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email/username and password are required'
      });
    }

    let user: any;
    if (email || String(login).includes('@')) {
      user = runQuery('SELECT * FROM users WHERE email = ?', [String(login).toLowerCase()])[0];
    } else {
      user = runQuery('SELECT * FROM users WHERE username = ?', [login])[0];
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const token = generateToken(user.id);

    runExec('UPDATE users SET updated_at = ? WHERE id = ?', [Date.now(), user.id]);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          oxygenId: user.oxygen_id,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

router.post('/logout', authMiddleware, (_req: AuthRequest, res) => {
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
});

export default router;
