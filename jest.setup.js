require('@testing-library/jest-dom');

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

// Mock crypto.randomUUID
global.crypto.randomUUID = jest.fn(() => '12345678-1234-4321-abcd-1234567890ab');

// Mock DOMParser
global.DOMParser = class {
  parseFromString(str) {
    return document.implementation.createHTMLDocument().body;
  }
};

// Mock XMLSerializer
global.XMLSerializer = class {
  serializeToString(doc) {
    return doc.toString();
  }
};

// Mock FileReader for browser environment
global.FileReader = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }

  readAsArrayBuffer(file) {
    if (this.onload) {
      this.onload({ target: { result: new ArrayBuffer(8) } });
    }
  }
};

// Mock Document implementation
if (!document.implementation) {
  document.implementation = {
    createHTMLDocument: () => ({
      body: {
        innerHTML: '',
        querySelectorAll: () => []
      }
    })
  };
} 