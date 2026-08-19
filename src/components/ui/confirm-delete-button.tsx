'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from './button';
import { Modal } from './modal';

interface ConfirmDeleteButtonProps {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  cancelLabel: string;
  onAction: (formData: FormData) => void;
  className?: string;
}

export function ConfirmDeleteButton({
  label,
  confirmTitle,
  confirmMessage,
  cancelLabel,
  onAction,
  className,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleConfirm() {
    startTransition(() => {
      if (formRef.current) {
        onAction(new FormData(formRef.current));
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={confirmTitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button variant="danger" onClick={handleConfirm} loading={isPending}>
              {label}
            </Button>
          </>
        }
      >
        <p>{confirmMessage}</p>
      </Modal>
      <form ref={formRef} className="hidden" />
    </>
  );
}
