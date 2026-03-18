import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export type SqliteScalar = Uint8Array | number | string | null;
export type SqliteRow = Record<string, SqliteScalar>;

export interface CreateSqliteAdapterInput {
  databaseBytes: ArrayBuffer;
  databaseLabel: string;
}

export interface SqliteAdapter {
  close(): void;
  queryRows(sql: string, params?: readonly SqliteScalar[]): SqliteRow[];
}

type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;
type SqlJsDatabase = InstanceType<SqlJsModule['Database']>;
type SqlJsStatement = ReturnType<SqlJsDatabase['prepare']>;

let sqlJsPromise: Promise<SqlJsModule> | null = null;

export class SqliteAdapterError extends Error {
  readonly causeValue: unknown;
  readonly databaseLabel: string;

  constructor(message: string, options: { cause?: unknown; databaseLabel: string }) {
    super(message);
    this.name = 'SqliteAdapterError';
    this.causeValue = options.cause;
    this.databaseLabel = options.databaseLabel;
  }
}

export async function createSqliteAdapter(
  input: CreateSqliteAdapterInput,
): Promise<SqliteAdapter> {
  const SQL = await getSqlJsModule();

  try {
    return new SqlJsBackedAdapter({
      database: new SQL.Database(new Uint8Array(input.databaseBytes.slice(0))),
      databaseLabel: input.databaseLabel,
    });
  } catch (error) {
    throw new SqliteAdapterError(
      `Failed to open SQLite database for ${input.databaseLabel}.`,
      { cause: error, databaseLabel: input.databaseLabel },
    );
  }
}

async function getSqlJsModule(): Promise<SqlJsModule> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => resolveSqlWasmUrl(),
    });
  }

  return sqlJsPromise;
}

function resolveSqlWasmUrl(): string {
  if (
    typeof process !== 'undefined'
    && typeof process.cwd === 'function'
    && sqlWasmUrl.startsWith('/node_modules/')
  ) {
    return `${process.cwd()}${sqlWasmUrl}`;
  }

  return sqlWasmUrl;
}

class SqlJsBackedAdapter implements SqliteAdapter {
  readonly #database: SqlJsDatabase;
  readonly #databaseLabel: string;
  #closed = false;

  constructor(input: { database: SqlJsDatabase; databaseLabel: string }) {
    this.#database = input.database;
    this.#databaseLabel = input.databaseLabel;
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#database.close();
    this.#closed = true;
  }

  queryRows(sql: string, params: readonly SqliteScalar[] = []): SqliteRow[] {
    this.#assertOpen();

    let statement: SqlJsStatement | null = null;

    try {
      statement = this.#database.prepare(sql);

      if (params.length > 0) {
        statement.bind([...params]);
      }

      const rows: SqliteRow[] = [];

      while (statement.step()) {
        rows.push(normaliseSqlRow(statement.getAsObject()));
      }

      return rows;
    } catch (error) {
      throw new SqliteAdapterError(
        `Failed to execute SQLite query against ${this.#databaseLabel}.`,
        { cause: error, databaseLabel: this.#databaseLabel },
      );
    } finally {
      statement?.free();
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new SqliteAdapterError(
        `SQLite adapter for ${this.#databaseLabel} has already been closed.`,
        { databaseLabel: this.#databaseLabel },
      );
    }
  }
}

function normaliseSqlRow(row: Record<string, unknown>): SqliteRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normaliseSqlValue(value)]),
  );
}

function normaliseSqlValue(value: unknown): SqliteScalar {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }

  return String(value);
}
