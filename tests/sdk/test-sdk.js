// Test SDK API
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Create a server instance
const server = new Server({
  name: 'test',
  version: '1.0.0'
});

// Log the available methods on the server
console.log('Server methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(server)));
console.log('Server properties:', Object.keys(server)); 