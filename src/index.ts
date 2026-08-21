/**
 * The isomorphic entry: manifest + contracts, nothing else.
 *
 * Server code and React components live behind their own entries
 * (`./server`, `./client`) so neither bundle drags the other's world in.
 */
export { manifest } from './manifest';
export * from './contracts/domain';
export * from './contracts/commands';
