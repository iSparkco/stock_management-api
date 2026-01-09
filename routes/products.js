const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// GET /products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// POST /products
router.post('/', authMiddleware, async (req, res) => {
  const { name_en, name_fr, name_es, price } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name_en, name_fr, name_es, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [name_en, name_fr, name_es, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add product' });
  }
});

// PUT /products/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name_en, name_fr, name_es, price } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name_en=$1, name_fr=$2, name_es=$3, price=$4 WHERE id=$5 RETURNING *',
      [name_en, name_fr, name_es, price, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// DELETE /products/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

module.exports = router;

