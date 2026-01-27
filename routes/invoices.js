const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');



/// 1. GET THE LATEST INVOICE NUMBER
/// This must be placed BEFORE any /:id routes
router.get('/last', authMiddleware, async (req, res) => {
  try {
    // We fetch only the most recent invoice_nb
    const result = await pool.query(
      'SELECT invoice_nb FROM invoices ORDER BY created_at DESC, id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ invoice_nb: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching last invoice:', err);
    res.status(500).json({ message: 'Server error fetching invoice number' });
  }
});


// POST /invoices – create invoice
// Note: Changed from '/invoices' to '/' because the router is mounted at /invoices
router.post('/', authMiddleware, async (req, res) => {
  const { project_name, notes, invoice_nb, total, items } = req.body;
  
  // Extract user ID from the auth middleware (from the JWT token)
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
       RETURNING id, project_name, notes, invoice_nb, total, created_at, time`,
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

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', err);
    res.status(500).json({ message: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});


router.get('/user/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        i.*,  -- This gets ALL fields from the invoices table
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'name_en', p.name_en
            )
          ) FILTER (WHERE ii.id IS NOT NULL),
          '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.user_id = $1
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch user invoices error:', err);
    res.status(500).json({ message: 'Failed to fetch user invoices' });
  }
});


router.get('/range', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const result = await pool.query(`
      SELECT 
        i.*,  -- This gets ALL fields from the invoices table
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'name_en', p.name_en
            )
          ) FILTER (WHERE ii.id IS NOT NULL),
          '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.created_at::date BETWEEN $1 AND $2
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [startDate, endDate]);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch date range error:', err);
    res.status(500).json({ message: 'Failed to fetch invoices in range' });
  }
});


router.get('/number/:invoiceNb', authMiddleware, async (req, res) => {
  const { invoiceNb } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        i.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'name_en', p.name_en
            )
          ) FILTER (WHERE ii.id IS NOT NULL),
          '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.invoice_nb = $1
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [invoiceNb]);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch by invoice number error:', err);
    res.status(500).json({ message: 'Failed to fetch invoice by number' });
  }
});


router.get('/project/:projectName', authMiddleware, async (req, res) => {
  const { projectName } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        i.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              'name_en', p.name_en
            )
          ) FILTER (WHERE ii.id IS NOT NULL),
          '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.project_name ILIKE $1
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [`%${projectName}%`]);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch by project name error:', err);
    res.status(500).json({ message: 'Failed to fetch invoices by project' });
  }
});

//Get Invoices
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.*, 
        -- User object (already working)
        (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'name', u.name
          )
          FROM users u
          WHERE u.id = i.userid
        ) AS users, 
        -- Items mapping: Fixed to include nested 'products' object
        COALESCE(
          json_agg(
            json_build_object(
              'invoice_id', ii.invoice_id,
              'product_id', ii.product_id,
              'qty', ii.qty,
              'price', ii.price,
              -- This creates the nested 'products' object your C# class expects
              'products', json_build_object(
                'id', p.id,
                'name_en', p.name_en
              )
            )
          ) FILTER (WHERE ii.id IS NOT NULL),
          '[]'
        ) AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch' });
  }
});


router.get('/search', authMiddleware, async (req, res) => {
  const { userId, startDate, endDate, invoiceNb, projectName } = req.query;

  let filters = [];
  let values = [];

  // Dynamically build the WHERE clause
  if (userId) {
    values.push(userId);
    filters.push(`i.userid = $${values.length}`);
  }
  if (startDate && endDate) {
    values.push(startDate, endDate);
    filters.push(`i.created_at::date BETWEEN $${values.length - 1} AND $${values.length}`);
  }
  if (invoiceNb) {
    values.push(invoiceNb);
    filters.push(`i.invoice_nb = $${values.length}`);
  }
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
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});


module.exports = router;
