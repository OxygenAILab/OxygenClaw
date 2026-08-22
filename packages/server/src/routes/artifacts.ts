import { Router } from 'express';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { runQuery } from '../services/db';

const router = Router();

router.get('/', optionalAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const taskId = req.query.taskId as string;
    const conversationId = req.query.conversationId as string;

    let query = 'SELECT * FROM artifacts WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (taskId) {
      query += ' AND task_id = ?';
      params.push(taskId);
    }

    if (conversationId) {
      query += ' AND conversation_id = ?';
      params.push(conversationId);
    }

    query += ' ORDER BY created_at DESC';

    const artifacts = runQuery(query, params);

    res.json({
      success: true,
      data: artifacts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch artifacts'
    });
  }
});

router.get('/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const artifactId = req.params.id;
    const userId = req.userId;

    let query = 'SELECT * FROM artifacts WHERE id = ?';
    const params: any[] = [artifactId];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const artifacts = runQuery(query, params);

    if (!artifacts || artifacts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }

    res.json({
      success: true,
      data: artifacts[0]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch artifact'
    });
  }
});

export default router;
