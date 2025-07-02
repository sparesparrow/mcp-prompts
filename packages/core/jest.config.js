module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/$1',
    '^@adapters-file/(.*)$': '<rootDir>/../adapters-file/src/$1',
    '^@adapters-memory/(.*)$': '<rootDir>/../adapters-memory/src/$1'
  }
}; 