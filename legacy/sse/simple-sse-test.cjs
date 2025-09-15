#!/usr/bin/env node

const EventSource = require('eventsource');

console.log('Starting simple SSE test...');

// Try connecting to the /events endpoint
const eventSource = new EventSource('http://localhost:3004/events');

// Set up event handlers
eventSource.onopen = () => {
  console.log('Connection opened');
};

eventSource.onerror = (error) => {
  console.error('EventSource error:', error);
};

eventSource.onmessage = (event) => {
  console.log('Received message:', event.data);
  try {
    const data = JSON.parse(event.data);
    console.log('Parsed data:', data);
  } catch (e) {
    console.log('Could not parse message as JSON');
  }
};

// Close the connection after 10 seconds
setTimeout(() => {
  console.log('Closing connection...');
  eventSource.close();
  console.log('Connection closed');
}, 10000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing connection...');
  eventSource.close();
  process.exit(0);
}); 