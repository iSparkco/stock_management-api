const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// 1. GET THE LATEST INVOICE NUMBER
router.get('/last', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT invoice_nb FROM invoices ORDER BY created_at DESC, id DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      return res.json({ invoice_nb: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching last invoice:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. GET ALL INVOICES
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, 
        (SELECT json_build_object('id', u.id, 'username', u.username, 'name', u.name)
         FROM users u WHERE u.id = i.userid) AS users, 
        COALESCE(
          json_agg(
            json_build_object(
              'invoice_id', ii.invoice_id,
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'products', json_build_object('id', p.id, 'name_en', p.name_en)
            )
          ) FILTER (WHERE ii.id IS NOT NULL), '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});
// 2. SEARCH INVOICES (Moved up to avoid conflict with /:id params)
router.get('/search', authMiddleware, async (req, res) => {
  // Extracting query parameters sent from C# HttpClient
  const { userId, startDate, endDate, invoiceNb, projectName } = req.query;
  
  let filters = [];
  let values = [];

  // Filter by User ID
  if (userId) {
    values.push(userId);
    filters.push(`i.userid = $${values.length}`);
  }

  // Filter by Date Range (Matches startDate and endDate from C#)
  if (startDate && endDate) {
    values.push(startDate, endDate);
    filters.push(`i.created_at::date BETWEEN $${values.length - 1} AND $${values.length}`);
  }

  // Filter by Invoice Number (Exact match)
  if (invoiceNb) {
    values.push(invoiceNb);
    filters.push(`i.invoice_nb = $${values.length}`);
  }

  // Filter by Project Name (Partial match using ILIKE)
  if (projectName) {
    values.push(`%${projectName}%`);
    filters.push(`i.project_name ILIKE $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const query = `
      SELECT i.*, 
        (SELECT json_build_object('id', u.id, 'username', u.username, 'name', u.name)
         FROM users u WHERE u.id = i.userid) AS users,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'products', json_build_object('id', p.id, 'name_en', p.name_en)
            )
          ) FILTER (WHERE ii.id IS NOT NULL), '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      ${whereClause}
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

// 3. POST /invoices
router.post('/', authMiddleware, async (req, res) => {
  const { project_name, notes, invoice_nb, total, items } = req.body;
  const loggedUserId = req.user.id; 

  if (!project_name || !invoice_nb || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Invalid request body' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoiceRes = await client.query(
      `INSERT INTO invoices (project_name, notes, invoice_nb, userid, total, created_at, time)
       VALUES ($1, $2, $3, $4, $5, NOW(), CURRENT_TIME)
       RETURNING *`,
      [project_name, notes, invoice_nb, loggedUserId, total]
    );
    const invoice = invoiceRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, qty, price)
         VALUES ($1, $2, $3, $4)`,
        [invoice.id, item.product_id, item.qty, item.price]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Invoice created successfully', invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// 4. GET BY USER ID (Corrected user_id to userid)
router.get('/user/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(`
      SELECT i.*, 
        COALESCE(
          json_agg(
            json_build_object('product_id', ii.product_id, 'qty', ii.qty, 'price', ii.price, 'name_en', p.name_en)
          ) FILTER (WHERE ii.id IS NOT NULL), '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.userid = $1
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});



// Keep other specialty routes below...
//router.get('/range', authMiddleware, async (req, res) => { /* same as your original with column checks */ });
//router.get('/number/:invoiceNb', authMiddleware, async (req, res) => { /* same as your original */ });
//router.get('/project/:projectName', authMiddleware, async (req, res) => { /* same as your original */ });

module.exports = router;
