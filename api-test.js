// Tệp này được tạo để kiểm tra API từ command line
// Chạy nó bằng cách sử dụng: node api-test.js
const https = require('https');

const baseUrl = 'https://1f5b841e-a2b7-48ba-b70a-96efcaf328e5.id.repl.co'; // Thay thế bằng URL của replit app của bạn

// Hàm gọi API
function callAPI(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(`${baseUrl}${path}`, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        
        try {
          const parsedData = JSON.parse(responseData);
          console.log('Response:', parsedData);
          resolve(parsedData);
        } catch (e) {
          console.log('Raw response:', responseData);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('API Request Error:', error);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Kiểm tra health check API
async function testHealthAPI() {
  console.log('Testing /api/health endpoint...');
  try {
    await callAPI('/api/health');
  } catch (error) {
    console.error('Health check test failed:', error);
  }
}

// Kiểm tra đăng nhập với một người dùng mẫu (nếu có)
async function testLogin() {
  console.log('Testing login with test user...');
  try {
    const loginData = {
      username: 'testuser',
      password: 'password123'
    };
    await callAPI('/api/login', 'POST', loginData);
  } catch (error) {
    console.error('Login test failed:', error);
  }
}

// Kiểm tra API tạo dự án
async function testCreateProject() {
  console.log('Testing create project API...');
  try {
    const projectData = {
      name: 'Test Project',
      description: 'A test project created via API',
      type: 'image-tracking',
      contentType: '3d-model',
      modelUrl: 'https://example.com/model.glb',
      targetImageUrl: 'https://example.com/target.jpg',
      status: 'active'
    };
    await callAPI('/api/projects', 'POST', projectData);
  } catch (error) {
    console.error('Create project test failed:', error);
  }
}

// Chạy các test
async function runTests() {
  await testHealthAPI();
  await testLogin();
  await testCreateProject();
  console.log('API tests completed');
}

runTests();