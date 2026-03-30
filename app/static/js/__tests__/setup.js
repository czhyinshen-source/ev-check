// Test setup file
import { vi } from 'vitest';

// Mock document
global.document = {
  addEventListener: vi.fn(),
  getElementById: vi.fn(),
  querySelector: vi.fn(() => document.createElement('div')),
  createElement: vi.fn(() => ({
    innerHTML: '',
    firstElementChild: {
      innerHTML: '',
      classList: {
        add: vi.fn()
      }
    },
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    }
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

// Mock window
global.window = {
  location: {
    href: ''
  }
};

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

// Mock alert
global.alert = vi.fn();

// Mock CSS classes
Object.defineProperty(global.document, 'classList', {
  value: {
    add: vi.fn(),
    remove: vi.fn()
  }
});