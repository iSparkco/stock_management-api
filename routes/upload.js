const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/');
    },
    filename: (req, file, cb) => {
        // We use the Product ID from the request body to name the file
        // If no ID is provided (new product), we use a timestamp
        const productId = req.body.productId || 'temp_' + Date.now();
        cb(null, `product_${productId}.jpg`);
    }
});

const upload = multer({ storage: storage });

router.post('/', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Upload failed' });
        
        // Return the filename so C# can save the URL
        res.json({ filename: req.file.filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
