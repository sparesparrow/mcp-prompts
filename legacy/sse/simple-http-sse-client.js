#!/usr/bin/env node

/**
 * Simple HTTP SSE Client
 * 
 * This script uses the HTTP module to connect to the SSE server and log events.
 */

import * as http from 'http';

// Configuration
const SSE_SERVER_URL = process.env.SSE_SERVER_URL || 'http://localhost:3004/events';

console.log(`Connecting to SSE server at ${SSE_SERVER_URL}...`);

// Parse the URL
const url = new URL(SSE_SERVER_URL);

// Set up the request options
const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
};

// Make the request
const req = http.request(options, (res) => {
  console.log('Connection established');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  // Handle data events
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
  
  // Handle end event
  res.on('end', () => {
    console.log('Connection closed by server');
  });
});

// Handle request errors
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