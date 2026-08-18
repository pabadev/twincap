import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  rows,
  keyExtractor,
  emptyMessage = 'No data',
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {rows.map((row) => (
            <tr key={keyExtractor(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
