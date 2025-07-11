const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp_originalname
    const userId = req.user.userId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only video files
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Upload progress video
router.post('/upload', authenticateToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { description, category, duration } = req.body;

    if (!description || !category) {
      return res.status(400).json({ error: 'Description and category are required' });
    }

    // Validate duration (10-60 seconds)
    const videoDuration = parseInt(duration);
    if (videoDuration < 10 || videoDuration > 60) {
      // Delete uploaded file if duration is invalid
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Video must be between 10-60 seconds' });
    }

    // Save video record to database
    const videoPath = `/uploads/videos/${req.file.filename}`;

    db.run(
      `INSERT INTO progress_videos (user_id, file_path, description, category, duration, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, videoPath, description, category, videoDuration, req.file.size],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          // Delete uploaded file if database save fails
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Failed to save video record' });
        }

        // Update user's last recording date
        const today = new Date().toISOString().split('T')[0];
        db.run(
          'UPDATE users SET last_recording_date = ? WHERE id = ?',
          [today, req.user.userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Failed to update last recording date:', updateErr);
            }
          }
        );

        res.status(201).json({
          message: 'Video uploaded successfully',
          video: {
            id: this.lastID,
            user_id: req.user.userId,
            file_path: videoPath,
            description,
            category,
            duration: videoDuration,
            file_size: req.file.size,
            created_at: new Date().toISOString()
          }
        });
      }
    );

  } catch (error) {
    console.error('Upload error:', error);
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// Get user's progress videos
router.get('/my-videos', authenticateToken, (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT v.*, u.username FROM progress_videos v
     JOIN users u ON v.user_id = u.id
     WHERE v.user_id = ?
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.userId, parseInt(limit), offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ videos: rows });
    }
  );
});

// Get community feed (only for users who recorded today)
router.get('/feed', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, category } = req.query;
  const offset = (page - 1) * limit;

  // First check if user has recorded today
  const today = new Date().toISOString().split('T')[0];

  db.get(
    'SELECT last_recording_date FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const hasRecordedToday = user && user.last_recording_date === today;

      if (!hasRecordedToday) {
        return res.status(403).json({
          error: 'Access denied. Record your daily progress to unlock the feed.',
          locked: true
        });
      }

      // Build query for feed
      let query = `
        SELECT v.*, u.username, u.id as user_id,
               (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count
        FROM progress_videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.user_id != ?
      `;
      const params = [req.user.userId];

      if (category) {
        query += ' AND v.category = ?';
        params.push(category);
      }

      query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      db.all(query, params, (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          videos: rows,
          hasRecordedToday: true
        });
      });
    }
  );
});

// Get single video details
router.get('/:id', authenticateToken, (req, res) => {
  const videoId = req.params.id;

  db.get(
    `SELECT v.*, u.username, u.id as user_id,
            (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id) as is_following
     FROM progress_videos v
     JOIN users u ON v.user_id = u.id
     WHERE v.id = ?`,
    [req.user.userId, videoId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({
        video: {
          ...row,
          is_following: Boolean(row.is_following)
        }
      });
    }
  );
});

// Delete user's video
router.delete('/:id', authenticateToken, (req, res) => {
  const videoId = req.params.id;

  // First get the video to check ownership and get file path
  db.get(
    'SELECT file_path FROM progress_videos WHERE id = ? AND user_id = ?',
    [videoId, req.user.userId],
    (err, video) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!video) {
        return res.status(404).json({ error: 'Video not found or not authorized' });
      }

      // Delete from database
      db.run(
        'DELETE FROM progress_videos WHERE id = ? AND user_id = ?',
        [videoId, req.user.userId],
        function(deleteErr) {
          if (deleteErr) {
            return res.status(500).json({ error: 'Failed to delete video record' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Video not found' });
          }

          // Delete physical file
          const filePath = path.join(__dirname, '../..', video.file_path);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (fileErr) {
              console.error('Failed to delete video file:', fileErr);
            }
          }

          res.json({ message: 'Video deleted successfully' });
        }
      );
    }
  );
});

// Get user's recording stats
router.get('/stats/user', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Get various stats
  Promise.all([
    // Total videos
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM progress_videos WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    }),

    // Current streak
    new Promise((resolve, reject) => {
      db.all(
        `SELECT DATE(created_at) as date FROM progress_videos
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else {
            // Calculate streak
            let streak = 0;
            const today = new Date();
            const dates = rows.map(row => new Date(row.date));

            for (let i = 0; i < dates.length; i++) {
              const daysDiff = Math.floor((today - dates[i]) / (1000 * 60 * 60 * 24));
              if (daysDiff === i) {
                streak++;
              } else {
                break;
              }
            }
            resolve(streak);
          }
        }
      );
    }),

    // Followers count
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM follows WHERE following_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    })
  ])
  .then(([totalVideos, currentStreak, followers]) => {
    res.json({
      totalVideos,
      currentStreak,
      followers
    });
  })
  .catch(err => {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  });
});

// Check if user has recorded today
router.get('/check/today', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.get(
    'SELECT last_recording_date FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const hasRecordedToday = user && user.last_recording_date === today;
      res.json({ hasRecordedToday });
    }
  );
});

module.exports = router;
