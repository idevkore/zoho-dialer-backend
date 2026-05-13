/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.js'],
  transform: {},
  moduleFileExtensions: ['js'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
