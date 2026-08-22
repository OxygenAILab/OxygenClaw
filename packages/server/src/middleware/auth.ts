import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery } from '../services/db';

const JWT_SECRET = process.env.JWT_SECRET || 'oxygenclaw-dev-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    oxygenId: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const token = authHeader.slice(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = runQuery('SELECT id, email, username, oxygen_id as oxygenId FROM users WHERE id = ?', [decoded.userId])[0] as any;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = runQuery('SELECT id, email, username, oxygen_id as oxygenId FROM users WHERE id = ?', [decoded.userId])[0] as any;
      if (user) {
        req.userId = user.id;
        req.user = user;
      }
    } catch {
      // Token invalid, continue as guest
    }
  }
  
  next();
}
