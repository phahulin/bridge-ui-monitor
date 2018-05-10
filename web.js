const express = require('express');
const app = express();

const path = require('path');
const fs = require('fs');
const RESULT_FILE = path.join(__dirname, './result.json');

app.get('/', function (req, res) {
    var result = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    result.timeDiff = Math.floor((new Date() - new Date(result.completedAt))/1000);
    res.json(result);
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, function () {
    console.log('Listening on port ' + PORT);
});
