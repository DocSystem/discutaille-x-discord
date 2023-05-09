const fs = require('fs');
const PNG = require('pngjs').PNG;
const crypto = require('crypto');
const express = require("express");
const app = express();

function openImage() {
    // return skul.png as a buffer
    return fs.readFileSync('skul.png');
}

function changeImageTint(image, filter) {
    const png = PNG.sync.read(image);
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;
            png.data[idx] *= filter[0];
            png.data[idx + 1] *= filter[1];
            png.data[idx + 2] *= filter[2];
        }
    }
    return PNG.sync.write(png);
}

function getColorForPseudo(pseudo) {
    const filter = [0.0, 0.0, 0.0];
    const hash = crypto.createHash('sha256').update(pseudo).digest('hex');
    for (let i = 0; i < 3; i++) {
        filter[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16) / 255.0;
    }
    return filter;
}

function generateAvatar(pseudo) {
    const image = openImage();
    const filter = getColorForPseudo(pseudo);
    return changeImageTint(image, filter);
}

app.get("/avatar/:pseudo", (req, res) => {
    const pseudo = req.params.pseudo;
    const avatar = generateAvatar(pseudo);
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': avatar.length,
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
    })
    res.end(avatar);
});

exports.generateAvatar = generateAvatar;
exports.app = app;
