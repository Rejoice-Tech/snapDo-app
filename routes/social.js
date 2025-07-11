const express = require('express');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Follow a user
router.post('/follow/:userId', authenticateToken, (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.userId;

  if (targetUserId == currentUserId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  // Check if target user exists
  db.get('SELECT id FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    db.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [currentUserId, targetUserId],
      (err, existing) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (existing) {
          return res.status(400).json({ error: 'Already following this user' });
        }

        // Create follow relationship
        db.run(
          'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
          [currentUserId, targetUserId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to follow user' });
            }

            res.status(201).json({
              message: 'Successfully followed user',
              followId: this.lastID
            });
          }
        );
      }
    );
  });
});

// Unfollow a user
router.delete('/unfollow/:userId', authenticateToken, (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.userId;

  db.run(
    'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
    [currentUserId, targetUserId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Not following this user' });
      }

      res.json({ message: 'Successfully unfollowed user' });
    }
  );
});

// Get user's followers
router.get('/followers/:userId?', authenticateToken, (req, res) => {
  const userId = req.params.userId || req.user.userId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT u.id, u.username, u.created_at,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM progress_videos v WHERE v.user_id = u.id) as video_count,
            (SELECT COUNT(*) FROM follows f3 WHERE f3.follower_id = ? AND f3.following_id = u.id) as is_following
     FROM follows f
     JOIN users u ON f.follower_id = u.id
     WHERE f.following_id = ?
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.userId, userId, parseInt(limit), offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const followers = rows.map(row => ({
        ...row,
        is_following: Boolean(row.is_following)
      }));

      res.json({ followers });
    }
  );
});

// Get users that a user is following
router.get('/following/:userId?', authenticateToken, (req, res) => {
  const userId = req.params.userId || req.user.userId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT u.id, u.username, u.created_at,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM progress_videos v WHERE v.user_id = u.id) as video_count,
            (SELECT COUNT(*) FROM follows f3 WHERE f3.follower_id = ? AND f3.following_id = u.id) as is_following
     FROM follows f
     JOIN users u ON f.following_id = u.id
     WHERE f.follower_id = ?
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.userId, userId, parseInt(limit), offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const following = rows.map(row => ({
        ...row,
        is_following: Boolean(row.is_following)
      }));

      res.json({ following });
    }
  );
});

// Get suggested users to follow
router.get('/suggestions', authenticateToken, (req, res) => {
  const { limit = 10 } = req.query;

  // Get users with most videos that current user isn't following
  db.all(
    `SELECT u.id, u.username, u.created_at,
            COUNT(v.id) as video_count,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) as follower_count
     FROM users u
     LEFT JOIN progress_videos v ON u.id = v.user_id
     WHERE u.id != ?
     AND u.id NOT IN (
       SELECT following_id FROM follows WHERE follower_id = ?
     )
     GROUP BY u.id
     ORDER BY video_count DESC, follower_count DESC
     LIMIT ?`,
    [req.user.userId, req.user.userId, parseInt(limit)],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ suggestions: rows });
    }
  );
});

// Search users
router.get('/search', authenticateToken, (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  const searchTerm = `%${q.trim()}%`;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT u.id, u.username, u.created_at,
            (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM progress_videos v WHERE v.user_id = u.id) as video_count,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.id) as is_following
     FROM users u
     WHERE u.username LIKE ? AND u.id != ?
     ORDER BY
       CASE WHEN u.username = ? THEN 0 ELSE 1 END,
       follower_count DESC
     LIMIT ? OFFSET ?`,
    [req.user.userId, searchTerm, req.user.userId, q.trim(), parseInt(limit), offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const users = rows.map(row => ({
        ...row,
        is_following: Boolean(row.is_following)
      }));

      res.json({ users });
    }
  );
});

// Get user profile with follow stats
router.get('/profile/:userId', authenticateToken, (req, res) => {
  const userId = req.params.userId;

  db.get(
    `SELECT u.id, u.username, u.created_at,
            (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) as following_count,
            (SELECT COUNT(*) FROM progress_videos v WHERE v.user_id = u.id) as video_count,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.id) as is_following
     FROM users u
     WHERE u.id = ?`,
    [req.user.userId, userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          ...user,
          is_following: Boolean(user.is_following)
        }
      });
    }
  );
});

// Get follow stats for current user
router.get('/stats', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  Promise.all([
    // Followers count
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),

    // Following count
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    })
  ])
  .then(([followers, following]) => {
    res.json({
      followers,
      following
    });
  })
  .catch(err => {
    console.error('Follow stats error:', err);
    res.status(500).json({ error: 'Failed to get follow stats' });
  });
});

module.exports = router;
