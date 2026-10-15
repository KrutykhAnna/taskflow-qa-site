// Минимальные типы sql.js — только то, что использует движок (вместо @types/sql.js с его зависимостями).
declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null

  export interface Statement {
    step(): boolean
    get(): SqlValue[]
    getColumnNames(): string[]
    free(): boolean
  }

  export interface StatementIterator extends Iterable<Statement> {
    next(): IteratorResult<Statement>
  }

  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export interface Database {
    exec(sql: string): QueryExecResult[]
    run(sql: string): Database
    iterateStatements(sql: string): StatementIterator
    getRowsModified(): number
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database
  }

  export interface InitConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitConfig): Promise<SqlJsStatic>
}
