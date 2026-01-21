const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcrypt'); 

// GET /users
router.get('/', authMiddleware, async (req, res) => {
  try {
    // We select password_hash in case the C# app needs to verify something, 
    // but usually, it's safer to omit it unless needed for a specific logic.
    const result = await pool.query('SELECT id, username, password_hash, role, isadmin FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /users
router.post('/', authMiddleware, async (req, res) => {
  const { username, password, role, isadmin } = req.body;
  try {
    // Hash the password to store in the password_hash column
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, isadmin) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, hashedPassword, role, isadmin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add user' });
  }
});

// PUT /users/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { username, role, isadmin } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET username=$1, role=$2, isadmin=$3 WHERE id=$4 RETURNING *',
      [username, role, isadmin, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /users/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;
