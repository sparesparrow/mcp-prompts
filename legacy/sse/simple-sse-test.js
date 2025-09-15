#!/usr/bin/env node

import * as http from 'http';

console.log('Starting simple SSE test...');

// Make a request to the SSE endpoint
const req = http.request('http://localhost:3004/events', {
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
});

req.on('response', (res) => {
  console.log('Connection established');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  res.on('data', (chunk) => {
    const data = chunk.toString();
    console.log('Received data:', data);
    
    try {
      // Try to parse any JSON in the data
      if (data.includes('data:')) {
        const jsonStr = data.split('data:')[1].trim();
        if (jsonStr) {
          const json = JSON.parse(jsonStr);
          console.log('Parsed JSON:', json);
        }
      }
    } catch (e) {
      console.log('Could not parse data as JSON:', e.message);
    }
  });
  
  res.on('end', () => {
    console.log('Connection closed by server');
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

// Send the request
req.end();

console.log('Request sent, waiting for response...');

// Close the connection after 30 seconds
setTimeout(() => {
  console.log('Timeout reached, ending test...');
  req.destroy();
  process.exit(0);
}, 30000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing connection...');
  req.destroy();
  process.exit(0);
}); 