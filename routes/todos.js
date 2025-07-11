const express = require('express');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all todos for authenticated user
router.get('/', authenticateToken, (req, res) => {
  const { completed, priority, search } = req.query;
  let query = `
    SELECT t.*, GROUP_CONCAT(c.name) as categories
    FROM todos t
    LEFT JOIN todo_categories tc ON t.id = tc.todo_id
    LEFT JOIN categories c ON tc.category_id = c.id
    WHERE t.user_id = ?
  `;
  const params = [req.user.userId];

  // Add filters
  if (completed !== undefined) {
    query += ' AND t.completed = ?';
    params.push(completed === 'true' ? 1 : 0);
  }

  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }

  if (search) {
    query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' GROUP BY t.id ORDER BY t.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const todos = rows.map(row => ({
      ...row,
      completed: Boolean(row.completed),
      categories: row.categories ? row.categories.split(',') : []
    }));

    res.json({ todos });
  });
});

// Get single todo
router.get('/:id', authenticateToken, (req, res) => {
  const todoId = req.params.id;

  db.get(
    `SELECT t.*, GROUP_CONCAT(c.name) as categories
     FROM todos t
     LEFT JOIN todo_categories tc ON t.id = tc.todo_id
     LEFT JOIN categories c ON tc.category_id = c.id
     WHERE t.id = ? AND t.user_id = ?
     GROUP BY t.id`,
    [todoId, req.user.userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      const todo = {
        ...row,
        completed: Boolean(row.completed),
        categories: row.categories ? row.categories.split(',') : []
      };

      res.json({ todo });
    }
  );
});

// Create new todo
router.post('/', authenticateToken, (req, res) => {
  const { title, description, priority, due_date, categories } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.run(
    'INSERT INTO todos (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.userId, title, description || null, priority || 'medium', due_date || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create todo' });
      }

      const todoId = this.lastID;

      // Add categories if provided
      if (categories && Array.isArray(categories) && categories.length > 0) {
        const categoryPromises = categories.map(categoryId => {
          return new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO todo_categories (todo_id, category_id) VALUES (?, ?)',
              [todoId, categoryId],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        Promise.all(categoryPromises)
          .then(() => {
            // Fetch the created todo with categories
            db.get(
              `SELECT t.*, GROUP_CONCAT(c.name) as categories
               FROM todos t
               LEFT JOIN todo_categories tc ON t.id = tc.todo_id
               LEFT JOIN categories c ON tc.category_id = c.id
               WHERE t.id = ?
               GROUP BY t.id`,
              [todoId],
              (err, row) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                const todo = {
                  ...row,
                  completed: Boolean(row.completed),
                  categories: row.categories ? row.categories.split(',') : []
                };

                res.status(201).json({ message: 'Todo created successfully', todo });
              }
            );
          })
          .catch(() => {
            res.status(500).json({ error: 'Failed to add categories' });
          });
      } else {
        // Return todo without categories
        db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          const todo = {
            ...row,
            completed: Boolean(row.completed),
            categories: []
          };

          res.status(201).json({ message: 'Todo created successfully', todo });
        });
      }
    }
  );
});

// Update todo
router.put('/:id', authenticateToken, (req, res) => {
  const todoId = req.params.id;
  const { title, description, completed, priority, due_date } = req.body;

  // First check if todo exists and belongs to user
  db.get(
    'SELECT id FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.user.userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      const updates = [];
      const params = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (completed !== undefined) {
        updates.push('completed = ?');
        params.push(completed ? 1 : 0);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        params.push(priority);
      }
      if (due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(due_date);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(todoId);

      db.run(
        `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to update todo' });
          }

          // Fetch updated todo
          db.get(
            `SELECT t.*, GROUP_CONCAT(c.name) as categories
             FROM todos t
             LEFT JOIN todo_categories tc ON t.id = tc.todo_id
             LEFT JOIN categories c ON tc.category_id = c.id
             WHERE t.id = ?
             GROUP BY t.id`,
            [todoId],
            (err, row) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              const todo = {
                ...row,
                completed: Boolean(row.completed),
                categories: row.categories ? row.categories.split(',') : []
              };

              res.json({ message: 'Todo updated successfully', todo });
            }
          );
        }
      );
    }
  );
});

// Delete todo
router.delete('/:id', authenticateToken, (req, res) => {
  const todoId = req.params.id;

  db.run(
    'DELETE FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete todo' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json({ message: 'Todo deleted successfully' });
    }
  );
});

// Get categories for user
router.get('/categories/list', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY name',
    [req.user.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ categories: rows });
    }
  );
});

// Create new category
router.post('/categories', authenticateToken, (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  db.run(
    'INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)',
    [req.user.userId, name, color || '#3498db'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create category' });
      }

      const category = {
        id: this.lastID,
        user_id: req.user.userId,
        name,
        color: color || '#3498db'
      };

      res.status(201).json({ message: 'Category created successfully', category });
    }
  );
});

module.exports = router;
