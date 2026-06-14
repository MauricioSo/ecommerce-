export interface UnitOfWork {
  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}
