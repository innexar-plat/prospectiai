const https = require('https');

async function test() {
    const options = {
        hostname: 'prospectorai.innexar.com.br',
        port: 443,
        headers: {
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-Host': 'prospectorai.innexar.com.br'
        }
    };

    const getContents = (path) => {
        return new Promise((resolve, reject) => {
            https.get({ ...options, path }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data
                }));
            }).on('error', reject);
        });
    };

    console.log('--- Fetching CSRF ---');
    const csrfRes = await getContents('/api/auth/csrf');
    console.log('CSRF Status:', csrfRes.statusCode);
    if (csrfRes.statusCode !== 200) {
        console.log('CSRF failed:', csrfRes.data);
        return;
    }

    const csrfData = JSON.parse(csrfRes.data);
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF Token:', csrfToken);
    console.log('Cookies from CSRF:', csrfRes.headers['set-cookie']);

    const cookieStr = csrfRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';

    const postData = JSON.stringify({
        csrfToken,
        email: 'viniciusvasques7874@gmail.com',
        password: 'test',
        redirect: false
    });

    console.log('\n--- Attempting Login ---');
    const req = https.request({
        ...options,
        path: '/api/auth/signin/credentials',
        method: 'POST',
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Cookie': cookieStr
        }
    }, (res) => {
        console.log('Login Status:', res.statusCode);
        console.log('Login Headers:', res.headers);
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log('Login Body:', body);
        });
    });

    req.on('error', (e) => console.error('Login Error:', e));
    req.write(postData);
    req.end();
}

test().catch(err => console.error('Test script crashed:', err));
