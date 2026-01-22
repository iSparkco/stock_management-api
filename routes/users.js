const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcrypt'); 

// GET /users
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Added 'name' and 'deleted' to match your C# class
    const result = await pool.query(
      'SELECT id, name, username, password_hash, role, isadmin, deleted FROM users WHERE deleted = false ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /users
router.post('/', authMiddleware, async (req, res) => {
  // Extract 'name' from req.body to match C# class
  const { name, username, password_hash, role, isadmin } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password_hash, 10);
    
    // Included 'name' in the INSERT query
    const result = await pool.query(
      'INSERT INTO users (name, username, password_hash, role, isadmin, deleted) VALUES ($1, $2, $3, $4, $5, false) RETURNING *',
      [name, username, hashedPassword, role, isadmin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST ERROR:", err.message);
    res.status(500).json({ message: 'Failed to add user' });
  }
});

// PUT /users/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, username, role, isadmin, deleted, password_hash } = req.body;

  try {
    let result;
    
    if (password_hash && password_hash.length > 0) {
      // 1. If a password is provided, HASH IT before saving
      const hashedPassword = await bcrypt.hash(password_hash, 10);
      result = await pool.query(
        'UPDATE users SET name=$1, username=$2, role=$3, isadmin=$4, deleted=$5, password_hash=$6 WHERE id=$7 RETURNING *',
        [name, username, role, isadmin, deleted || false, hashedPassword, id]
      );
    } else {
      // 2. If no password is provided, update other fields only
      result = await pool.query(
        'UPDATE users SET name=$1, username=$2, role=$3, isadmin=$4, deleted=$5 WHERE id=$6 RETURNING *',
        [name, username, role, isadmin, deleted || false, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT ERROR:", err.message);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /users/:id (Soft Delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Instead of deleting, we set deleted = true to match your C# model logic
    await pool.query('UPDATE users SET deleted = true WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;
