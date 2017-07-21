export function promisify<R = any>(callback: Function, throwError?: boolean): Promise<R>;
export function promisifyAll<T>(object: T, throwError?: boolean): T;