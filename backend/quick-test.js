// Quick test script - run with: node quick-test.js
const http = require('http');

const TESTS = [
  { name: 'Health Check', method: 'GET', path: '/health' },
];

const EMAIL = `test${Date.now()}@example.com`;
const PASSWORD = 'testpassword123';

async function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 KaraokeYT Backend Quick Test\n');
  
  // Test 1: Health
  console.log('1. Health Check...');
  try {
    const health = await makeRequest('GET', '/health');
    if (health.body.status === 'ok') {
      console.log('   ✅ Server is running\n');
    } else {
      console.log('   ❌ Server error:', health.body);
      process.exit(1);
    }
  } catch (err) {
    console.log('   ❌ Server not responding. Is it running? (npm run dev)\n');
    process.exit(1);
  }

  // Test 2: Register
  console.log('2. Register User...');
  console.log('   Email:', EMAIL);
  try {
    const register = await makeRequest('POST', '/api/auth/register', {
      email: EMAIL,
      password: PASSWORD,
      name: 'Test User'
    });
    
    if (register.body.accessToken) {
      console.log('   ✅ Register successful');
      console.log('   Token:', register.body.accessToken.substring(0, 30) + '...');
      console.log('   API Key:', register.body.apiKey?.substring(0, 30) + '...\n');
      
      // Save for other tests
      const token = register.body.accessToken;
      
      // Test 3: Get User
      console.log('3. Get User Info...');
      const user = await makeRequest('GET', '/api/user/me', null, {
        'Authorization': `Bearer ${token}`
      });
      
      if (user.body.user?.email === EMAIL) {
        console.log('   ✅ Got user info:', user.body.user.name, '\n');
      } else {
        console.log('   ❌ Failed:', user.body, '\n');
      }
      
      // Test 4: API Key Status
      console.log('4. API Key Status...');
      const keyStatus = await makeRequest('GET', '/api/api-key/status', null, {
        'Authorization': `Bearer ${token}`
      });
      
      if (keyStatus.body.quota) {
        console.log('   ✅ Quota:', keyStatus.body.quota, '| Used:', keyStatus.body.used, '\n');
      } else {
        console.log('   ❌ Failed:', keyStatus.body, '\n');
      }
      
      // Test 5: Logout
      console.log('5. Logout...');
      const logout = await makeRequest('POST', '/api/auth/logout', null, {
        'Authorization': `Bearer ${token}`
      });
      
      if (logout.body.success) {
        console.log('   ✅ Logout successful\n');
      } else {
        console.log('   ❌ Failed:', logout.body, '\n');
      }
      
    } else {
      console.log('   ❌ Register failed:', register.body, '\n');
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message, '\n');
  }
  
  console.log('=========================');
  console.log('✅ All basic tests done!');
  console.log('=========================');
}

runTests();
