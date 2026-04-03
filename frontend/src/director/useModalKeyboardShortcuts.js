import { useEffect } from 'react';

const isTextEditableTarget = (target) => {
  if (!target) return false;

  const tagName = target.tagName;
  if (!tagName) return false;

  return tagName === 'TEXTAREA' || target.isContentEditable;
};

const useModalKeyboardShortcuts = ({ isOpen, onEscape, onEnter, enableEnter = true }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const submitForm = (formElement) => {
      if (!formElement) return;

      if (typeof formElement.requestSubmit === 'function') {
        formElement.requestSubmit();
        return;
      }

      formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (typeof onEscape === 'function') onEscape();
        return;
      }

      if (event.key === 'Enter' && enableEnter) {
        if (isTextEditableTarget(event.target)) return;

        const activeElement = event.target || document.activeElement;
        const formElement = typeof activeElement?.closest === 'function' ? activeElement.closest('form') : null;

        event.preventDefault();
        if (typeof onEnter === 'function') {
          onEnter();
          return;
        }

        submitForm(formElement);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onEscape, onEnter, enableEnter]);
};

export default useModalKeyboardShortcuts;
