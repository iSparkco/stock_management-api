// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const pool = require("./db");
// const auth = require("./auth");
// const { v4: uuidv4 } = require("uuid");

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(auth);

// // GET PRODUCTS
// app.get("/api/products", async (req, res) => {
//   const result = await pool.query("SELECT * FROM products ORDER BY id");
//   res.json(result.rows);
// });

// // CREATE INVOICE
// app.post("/api/invoices", async (req, res) => {
//   const { total } = req.body;

//   const id = uuidv4();
//   await pool.query(
//     "INSERT INTO invoices(id, app_name, total) VALUES ($1,$2,$3)",
//     [id, req.appName, total]
//   );

//   res.json({ success: true, invoiceId: id });
// });

// app.listen(process.env.PORT, () =>
//   console.log(`API running on port ${process.env.PORT}`)
// );


// // GET products
// app.get('/products', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM products');
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST product
// app.post('/products', async (req, res) => {
//   const { name_en, name_fr, name_es, price } = req.body;
//   try {
//     const result = await pool.query(
//       'INSERT INTO products (name_en, name_fr, name_es, price) VALUES ($1,$2,$3,$4) RETURNING *',
//       [name_en, name_fr, name_es, price]
//     );
//     res.json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // app.listen(3000, () => {
// //   console.log('API running on http://192.168.0.108:3000');
// });



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const loginRouter = require('./routes/login');
const productsRouter = require('./routes/products');
const invoiceRouter = require('./routes/invoices'); // ✅ FIXED
const userRouter = require('./routes/users'); // ✅ FIXED

const app = express();
const PORT = process.env.PORT || 3000;

console.log('DB_HOST:', process.env.DB_HOST);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/login', loginRouter);
app.use('/products', productsRouter);
app.use('/invoices', invoiceRouter);
app.use('/users', userRouter);
// Serve images publicly
app.use(
  '/images',
  express.static(path.join(__dirname, 'images'), {
    maxAge: '30d',
    etag: true,
  })
);
// Health check
app.get('/', (req, res) => {
  res.send('Node.js API is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

