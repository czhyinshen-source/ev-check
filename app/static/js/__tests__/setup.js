// Test setup file
import { vi } from 'vitest';

// Mock window object
global.window = {};

// Mock API_BASE
global.API_BASE = '';

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

// Mock fetch
global.fetch = vi.fn();

// Mock URL
global.URL = {
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn()
};

// Mock document
global.document = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

// Mock alert
global.alert = vi.fn();