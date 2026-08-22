'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, type LucideIcon } from 'lucide-react';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { ActionIconButton } from './action-icon-button';
import { Icon } from './icon';
import { useT } from '../../i18n/client';
import { useToast } from '../../lib/hooks/use-toast';

export interface DeleteActionResult {
  success?: string;
  error?: string;
}

/**
 * Shape shared by every delete server action in the app:
 * `(prevState, formData) => { success?: toastKey, error?: toastKey }`.
 */
export type EntityDeleteAction = (
  prev: DeleteActionResult | null,
  formData: FormData,
) => Promise<DeleteActionResult>;

interface EntityDeleteButtonProps {
  /** Server action reference (delete*-style signature). */
  action: EntityDeleteAction;
  /** Hidden form fields sent to the action (supports multi-field cases). */
  fields: Record<string, string>;
  /** Localized trigger text; also used as the confirm button label. */
  label: string;
  confirmTitle: string;
  confirmMessage?: string;
  cancelLabel: string;
  /** Fallback toast texts when the action result carries no translatable key. */
  successMessage?: string;
  errorMessage?: string;
  /** Optional leading icon on the trigger button. */
  icon?: LucideIcon;
  /** Trigger style; defaults to filled danger. */
  variant?: 'danger' | 'ghost';
  /** Render the trigger as an icon-only ActionIconButton (table row actions). */
  iconOnly?: boolean;
  /** Stop click propagation (rows/cells with their own click handlers). */
  stopPropagation?: boolean;
  className?: string;
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }
  return formData;
}

/**
 * Single shared deletion flow: trigger button -> ConfirmDialog -> server
 * action invoked imperatively with hidden fields -> success/error toast ->
 * router.refresh(). Replaces the ten former useActionState + confirm()
 * copies; toast keys returned by actions resolve against the Toast
 * namespace exactly as before.
 */
export function EntityDeleteButton({
  action,
  fields,
  label,
  confirmTitle,
  confirmMessage,
  cancelLabel,
  successMessage,
  errorMessage,
  icon,
  variant = 'danger',
  iconOnly = false,
  stopPropagation = false,
  className,
}: EntityDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  function handleTriggerClick(e: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) e.stopPropagation();
    setOpen(true);
  }

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await action(null, buildFormData(fields));
      if (result?.success) {
        addToast(tToast(result.success) || successMessage || result.success, 'success');
        router.refresh();
      } else if (result?.error) {
        addToast(tToast(result.error) || errorMessage || result.error, 'error');
      }
    } catch (error) {
      // Action rejected (network/runtime): log quietly, matching the old
      // fire-and-forget submission behavior.
      console.error('EntityDeleteButton: delete action failed', error);
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      {iconOnly ? (
        <ActionIconButton
          type="button"
          icon={icon ?? Trash2}
          tone="danger"
          label={label}
          loading={pending}
          onClick={handleTriggerClick}
        />
      ) : (
        <Button
          type="button"
          variant={variant === 'ghost' ? 'ghost' : 'danger'}
          size="sm"
          className={className}
          disabled={pending}
          loading={pending}
          onClick={handleTriggerClick}
          aria-label={label}
        >
          {icon && <Icon icon={icon} size="sm" />}
          {label}
        </Button>
      )}
      <div onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title={confirmTitle}
          description={confirmMessage}
          confirmLabel={label}
          cancelLabel={cancelLabel}
          tone="danger"
          loading={pending}
        />
      </div>
    </>
  );
}
