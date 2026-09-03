import type { LegalDocument } from '@/content/legal/types';

/**
 * Server component que renderiza un documento legal (Política de Privacidad,
 * Términos, Cookies o Tratamiento de Datos) a partir de su contenido estático
 * en `src/content/legal/`. El cuerpo del documento proviene siempre de contenido
 * por locale (es/en); el framework (nav, volver, títulos de página) usa i18n.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <article className="mx-auto w-full max-w-prose">
      <header className="mb-8 border-b border-surface-border pb-6 dark:border-zinc-700">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-white">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {document.updatedAt}
        </p>
        {document.intro && (
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {document.intro}
          </p>
        )}
      </header>

      <div className="space-y-8">
        {document.sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph, i) => (
              <p
                key={i}
                className="mb-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
              >
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="ml-4 list-disc space-y-2">
                {section.list.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {section.table && (
              <div className="mt-4 overflow-x-auto">
                {section.table.caption && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {section.table.caption}
                  </p>
                )}
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border dark:border-zinc-700">
                      {section.table.headers.map((header, i) => (
                        <th
                          key={i}
                          scope="col"
                          className="px-3 py-2 font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, r) => (
                      <tr
                        key={r}
                        className="border-b border-surface-border align-top dark:border-zinc-700"
                      >
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className="px-3 py-2 text-zinc-700 dark:text-zinc-300"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
