declare module 'bcryptjs' {
  export function hash(dato: string, rondas: number): Promise<string>;
  export function compare(dato: string, hash: string): Promise<boolean>;
}
