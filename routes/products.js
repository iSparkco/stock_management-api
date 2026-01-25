const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// GET /products - Fetch all non-deleted products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*, 
        -- Build the nested categories object
        (
          SELECT json_build_object(
            'id', c.id,
            'ctg_name_en', c.ctg_name_en,
            'ctg_name_fr', c.ctg_name_fr,
            'ctg_name_ar', c.ctg_name_ar
          )
          FROM categories c
          WHERE c.id = p.categoryid
        ) AS categories
      FROM products p
      WHERE p.deleted = false
      ORDER BY p.id DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// POST /products - Add a new product
router.post('/', authMiddleware, async (req, res) => {
  const { 
    name_en, name_fr, name_ar, code, 
    image_url, price, qty, brand, 
    unit, categoryid 
  } = req.body;

  try {
    const query = `
      INSERT INTO products (
        name_en, name_fr, name_ar, code, 
        image_url, price, qty, brand, 
        unit, categoryid, deleted, created_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW()) 
      RETURNING *`;

    const values = [
      name_en, name_fr, name_ar, code, 
      image_url, price, qty, brand, 
      unit, categoryid
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST PRODUCT ERROR:", err.message);
    res.status(500).json({ message: 'Failed to add product' });
  }
});

// PUT /products/:id - Update a product
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { 
    name_en, name_fr, name_ar, code, 
    image_url, price, qty, brand, 
    unit, categoryid, deleted 
  } = req.body;

  try {
    const query = `
      UPDATE products SET 
        name_en=$1, name_fr=$2, name_ar=$3, code=$4, 
        image_url=$5, price=$6, qty=$7, brand=$8, 
        unit=$9, categoryid=$10, deleted=$11
      WHERE id=$12 RETURNING *`;

    const values = [
      name_en, name_fr, name_ar, code, 
      image_url, price, qty, brand, 
      unit, categoryid, deleted || false, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT PRODUCT ERROR:", err.message);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// DELETE /products/:id (Soft Delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // We update 'deleted' to true instead of removing the row
    await pool.query('UPDATE products SET deleted = true WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

//get products by specific filter
router.get('/', authMiddleware, async (req, res) => {
  const { 
    name_en, name_fr, name_ar, 
    categoryid, brand, code, 
    unit, minPrice, maxPrice, 
    startDate, endDate 
  } = req.query;

  let filters = ['p.deleted = false']; // Always filter out deleted items
  let values = [];

  // Helper to add filters safely
  const addFilter = (column, value, operator = '=') => {
    if (value !== undefined && value !== null && value !== '') {
      values.push(operator === 'ILIKE' ? `%${value}%` : value);
      filters.push(`${column} ${operator} $${values.length}`);
    }
  };

  addFilter('p.name_en', name_en, 'ILIKE');
  addFilter('p.name_fr', name_fr, 'ILIKE');
  addFilter('p.name_ar', name_ar, 'ILIKE');
  addFilter('p.categoryid', categoryid);
  addFilter('p.brand', brand, 'ILIKE');
  addFilter('p.code', code);
  addFilter('p.unit', unit);
  
  if (minPrice) addFilter('p.price', minPrice, '>=');
  if (maxPrice) addFilter('p.price', maxPrice, '<=');
  
  if (startDate && endDate) {
    values.push(startDate, endDate);
    filters.push(`p.created_at::date BETWEEN $${values.length - 1} AND $${values.length}`);
  }

  const whereClause = `WHERE ${filters.join(' AND ')}`;

  try {
    const query = `
      SELECT p.*, 
        (SELECT json_build_object(
            'id', c.id, 
            'ctg_name_en', c.ctg_name_en, 
            'ctg_name_fr', c.ctg_name_fr, 
            'ctg_name_ar', c.ctg_name_ar
         ) FROM categories c WHERE c.id = p.categoryid
        ) AS categories
      FROM products p
      ${whereClause}
      ORDER BY p.id DESC
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});




module.exports = router;
