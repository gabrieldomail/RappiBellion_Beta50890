const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index-live.html' : req.url);

    // Handle different file types
    const ext = path.extname(filePath);
    let contentType = 'text/html';

    switch (ext) {
        case '.css':
            contentType = 'text/css';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.webp':
            contentType = 'image/' + ext.slice(1);
            break;
        case '.mp3':
        case '.ogg':
            contentType = 'audio/' + ext.slice(1);
            break;
        case '.mp4':
            contentType = 'video/mp4';
            break;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

const PORT = 8083;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🎮 Open your browser and go to: http://localhost:${PORT}`);
    console.log(`🎯 Click "COMENZAR" to see the Cyberpunk HUD in action!`);
});
