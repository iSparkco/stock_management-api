const express = require('express');
const multer = require('multer');
const app = express();




// 1. This tells the server: "When someone asks for /images, look in the images folder"
app.use('/images', express.static('images'));

// 2. This tells Multer: "Save uploaded files into the images folder"
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/'); 
    },
    filename: (req, file, cb) => {
        // Renames file to: 1737532800-myfile.jpg
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 3. This is the ENDPOINT. C# sends the file HERE.
app.post('/upload', upload.single('image'), (req, res) => {
    // req.file.filename is the NEW name (e.g., "1737532800-myfile.jpg")
    res.json({ filename: req.file.filename }); 
});



// Correct way (CommonJS)
module.exports = router;