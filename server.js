/**
 * خادم محلي خفيف لتشغيل نظام المَذْخُورَة كموقع ويب على الشبكة المحلية (Node.js)
 * Local HTTP Server for Al-Madkhoorah Dates System
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

const server = http.createServer((req, res) => {
    // Enable CORS for local cross-device requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Endpoint to get server local IP addresses dynamically from browser
    if (req.url === '/api/server-info') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            port: PORT,
            ips: getLocalIpAddresses()
        }));
        return;
    }

    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    }

    const filePath = path.join(BASE_DIR, reqPath);

    // Prevent directory traversal
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html lang="ar" dir="rtl">
                <head><meta charset="utf-8"><title>الملف غير موجود</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2>⚠️ الصفحة أو الملف غير موجود</h2>
                    <p><a href="/">العودة إلى الصفحة الرئيسية لنظام المذخورة</a></p>
                </body>
                </html>
            `);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const altPort = 8085;
        console.log(`\n⚠️ المنفذ ${PORT} مشغول، جاري التشغيل على المنفذ البديل: ${altPort}...`);
        server.listen(altPort, '0.0.0.0');
    } else {
        console.error('Server error:', err);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    const activePort = server.address().port;
    const localIPs = getLocalIpAddresses();
    console.log('================================================================');
    console.log('🌴 تم تشغيل خادم موقع «المَذْخُورَة» بنجاح على الشبكة المحلية!');
    console.log('================================================================\n');
    console.log(`💻 من هذا الكمبيوتر افتح الرابط:`);
    console.log(`   http://localhost:${activePort}/\n`);
    
    if (localIPs.length > 0) {
        console.log(`📱 من أي جوال أو آيباد متصل بنفس شبكة الواي فاي افتح:`);
        localIPs.forEach(ip => {
            console.log(`   👉 http://${ip}:${PORT}/`);
        });
    } else {
        console.log(`📱 لفتح الموقع من الجوال: يرجى الاتصال بشبكة الواي فاي أولاً.`);
    }
    console.log('\n================================================================');
    console.log('جاري فتح الموقع في المتصفح تلقائياً... (اضغط Ctrl + C للإيقاف)');

    // Open browser automatically on Windows
    require('child_process').exec(`start "" "http://localhost:${PORT}/"`, () => {});
});
