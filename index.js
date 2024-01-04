const express = require('express');
const path = require('path');

const app = express();

app.use(express.json())

require('dotenv').config();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res,) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Start the server
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});