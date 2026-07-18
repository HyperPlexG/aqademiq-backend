// Unit tests only (src spec files) — pure logic, no DB/Redis needed.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }] },
};
