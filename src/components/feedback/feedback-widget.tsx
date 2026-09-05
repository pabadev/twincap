'use client';

import { useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, MessageCircle, Bug, Lightbulb } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { submitFeedbackAction } from '@/app/(main)/feedback/actions';

type FeedbackKind = 'comment' | 'bug' | 'suggestion';

const KIND_OPTIONS: {
  value: FeedbackKind;
  icon: typeof MessageSquare;
  labelKey: string;
  descKey: string;
}[] = [
  { value: 'comment', icon: MessageCircle, labelKey: 'comment', descKey: 'commentDesc' },
  { value: 'bug', icon: Bug, labelKey: 'bug', descKey: 'bugDesc' },
  { value: 'suggestion', icon: Lightbulb, labelKey: 'suggestion', descKey: 'suggestionDesc' },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [selectedKind, setSelectedKind] = useState<FeedbackKind>('comment');
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const t = useT('Feedback');
  const tCommon = useT('Common');

  function handleClose() {
    setOpen(false);
    setSelectedKind('comment');
    setState({});
  }

  function handleSubmit(formData: FormData) {
    formData.set('kind', selectedKind);
    formData.set('page', pathname);
    startTransition(async () => {
      const result = await submitFeedbackAction({}, formData);
      setState(result);
    });
  }

  return (
    <>
      {/* Floating action button — bottom-LEFT so it never overlaps the
          income/expense quick-add FAB (global-movement-provider) which owns
          the bottom-right corner. Mirrors that FAB's safe-area mobile inset. */}
      <button
        type="button"
        onClick={() => { setOpen(true); setState({}); }}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-30 flex h-14 w-14 items-center justify-center rounded-full border border-primary bg-transparent text-primary shadow-lg transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-zinc-950 cursor-pointer lg:bottom-8 lg:left-[calc(16rem+2rem)]"
        aria-label={t('fabLabel')}
      >
        <Icon icon={MessageSquare} size="lg" />
      </button>

      {/* Feedback modal */}
      <Modal open={open} onClose={handleClose} title={t('title')} size="md">
        {state.success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {t('thanks')}
            </p>
            <Button variant="secondary" onClick={handleClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            {/* Error display */}
            {state.error && (
              <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error === 'error.validation'
                  ? t('errorValidation')
                  : state.error === 'error.operationFailed'
                    ? t('errorFailed')
                    : t('errorFailed')}
              </div>
            )}

            {/* Kind selector */}
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('kindLabel')}
              </p>
              <div className="flex flex-col gap-2">
                {KIND_OPTIONS.map(({ value, icon, labelKey, descKey }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedKind(value)}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                      selectedKind === value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon icon={icon} size="md" />
                    <div>
                      <div className="font-medium">{t(labelKey)}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t(descKey)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="feedback-message"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t('messageLabel')}
              </label>
              <textarea
                id="feedback-message"
                name="message"
                rows={4}
                required
                maxLength={2000}
                placeholder={t('messagePlaceholder')}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>

            {/* Hidden fields */}
            <input type="hidden" name="kind" value={selectedKind} />
            <input type="hidden" name="page" value={pathname} />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={handleClose}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" loading={isPending}>
                {isPending ? t('sending') : t('send')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
