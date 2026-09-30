let counter = 0;

/** Local staging id for an imported statement row — never persisted as a Transaction id. */
export function generateStatementRowId(): string {
  counter++;
  return `stmt-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}
