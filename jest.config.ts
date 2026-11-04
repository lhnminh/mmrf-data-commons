import type { JestConfigWithTsJest } from 'ts-jest';

// assistant-ui and AG-UI ship ES modules only, as do these dependencies of theirs.
const CHAT_ESM_PACKAGES = '@assistant-ui|assistant-stream|assistant-cloud|@ag-ui|nanoid|zustand|safe-content-frame';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest',
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^redux-persist/lib/storage/createWebStorage$':
      '<rootDir>/__mocks__/createWebStorageMock.js',
  },
  testEnvironment: 'jest-fixed-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
    'node_modules/(flat|jsonpath-plus|uuid)/.+\\.(j|t)sx?$': ['ts-jest', {}],
    [`node_modules/(${CHAT_ESM_PACKAGES})/.+\\.m?js$`]: [
      'ts-jest',
      { tsconfig: { allowJs: true, esModuleInterop: true, module: 'commonjs' }, diagnostics: false },
    ],
  },
  transformIgnorePatterns: [`/node_modules/(?!(flat|jsonpath-plus|uuid|${CHAT_ESM_PACKAGES}))`],
  modulePaths: ['<rootDir>'],
  globals: {
    fetch: global.fetch,
  },
};

export default jestConfig;
