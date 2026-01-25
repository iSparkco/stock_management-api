const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// POST /invoices – create invoice
router.post('/', authMiddleware, async (req, res) => {
  const { customer_name, total, items } = req.body;

  if (!customer_name || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Invalid request body' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert invoice
    const invoiceRes = await client.query(
      `INSERT INTO invoices (project_name, total, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, customer_name, total, created_at`,
      [customer_name, total]
    );

    const invoice = invoiceRes.rows[0];

    // Insert items
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
        -- Select user details as a nested JSON object
        (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'name', u.name
          )
          FROM users u
          WHERE u.id = i.userid
        ) AS user,
        -- Aggregate invoice items into a nested JSON array
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
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch all invoices error:', err);
    res.status(500).json({ message: 'Failed to fetch all invoices' });
  }
});


module.exports = router;
