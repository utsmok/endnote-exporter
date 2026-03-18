declare module 'sql.js' {
  export type SqlJsBindValue = Uint8Array | number | string | null;

  export interface Statement {
    bind(values: readonly SqlJsBindValue[]): void;
    free(): void;
    getAsObject(): Record<string, unknown>;
    step(): boolean;
  }

  export interface Database {
    close(): void;
    prepare(sql: string): Statement;
  }

  export interface SqlJsStatic {
    Database: {
      new (data?: Uint8Array): Database;
      prototype: Database;
    };
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
