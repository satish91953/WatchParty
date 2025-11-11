// Polyfill for Node.js APIs used by simple-peer in browser
// This must be set up before any imports that use simple-peer

// Import polyfill packages
import process from 'process';
import { Buffer } from 'buffer';

// Make process and Buffer available globally
if (typeof window !== 'undefined') {
  // Set up process polyfill
  window.process = process;
  if (typeof global === 'undefined') {
    window.global = window;
  }
  global.process = process;
  
  // Set up Buffer polyfill
  window.Buffer = Buffer;
  global.Buffer = Buffer;
  
  // Ensure process.env exists
  if (!process.env) {
    process.env = {};
  }
  
  // Add global error handler to catch simple-peer errors
  const originalErrorHandler = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    // Check if it's a simple-peer related error
    if (message && (
      message.includes('_readableState') ||
      message.includes('readable-stream') ||
      message.includes('simple-peer')
    )) {
      console.warn('Caught simple-peer error (non-fatal):', message);
      // Return true to prevent default error handling
      return true;
    }
    
    // Call original error handler if it exists
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    
    return false;
  };
  
  // Also catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && (
      event.reason.toString().includes('_readableState') ||
      event.reason.toString().includes('readable-stream') ||
      event.reason.toString().includes('simple-peer')
    )) {
      console.warn('Caught simple-peer promise rejection (non-fatal):', event.reason);
      event.preventDefault(); // Prevent default error handling
    }
  });
}

