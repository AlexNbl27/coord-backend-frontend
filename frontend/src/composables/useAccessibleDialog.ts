import { watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';

export interface UseAccessibleDialogOptions {
  isOpen: Ref<boolean>;
  dialogRef: Ref<HTMLElement | null>;
  initialFocusRef?: Ref<HTMLElement | null>;
  onClose?: () => void;
  targetBackgroundSelectors?: string[];
  lockScroll?: boolean;
}

export function useAccessibleDialog(options: UseAccessibleDialogOptions) {
  const {
    isOpen,
    dialogRef,
    initialFocusRef,
    onClose,
    targetBackgroundSelectors = ['#main-content', 'header', 'footer'],
    lockScroll = true,
  } = options;

  let previouslyFocusedElement: HTMLElement | null = null;
  const inertElements: HTMLElement[] = [];
  let isActive = false;

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([aria-hidden="true"]), ' +
        '[href]:not([aria-hidden="true"]), ' +
        'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]), ' +
        'select:not([disabled]):not([aria-hidden="true"]), ' +
        'textarea:not([disabled]):not([aria-hidden="true"]), ' +
        '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
      )
    ).filter((el) => el.offsetParent !== null || el.getAttribute('role') !== null || true);
  };

  const makeBackgroundInert = () => {
    targetBackgroundSelectors.forEach((selector) => {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      elements.forEach((el) => {
        // Ne pas marquer inerte si l'élément contient la boîte de dialogue
        if (dialogRef.value && (el.contains(dialogRef.value) || el === dialogRef.value)) {
          return;
        }
        if (!el.getAttribute('aria-hidden')) {
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('inert', '');
          inertElements.push(el);
        }
      });
    });
  };

  const restoreBackground = () => {
    while (inertElements.length > 0) {
      const el = inertElements.pop();
      if (el) {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      }
    }
  };

  const focusInitial = () => {
    if (initialFocusRef?.value) {
      initialFocusRef.value.focus();
      return;
    }

    if (dialogRef.value) {
      const focusable = getFocusableElements(dialogRef.value);
      if (focusable.length > 0) {
        focusable[0].focus();
        return;
      }
      dialogRef.value.focus();
    }
  };

  const activate = () => {
    if (isActive) return;
    isActive = true;

    // Sauvegarder l'élément actif avant ouverture
    if (
      document.activeElement instanceof HTMLElement &&
      (!dialogRef.value || !dialogRef.value.contains(document.activeElement))
    ) {
      previouslyFocusedElement = document.activeElement;
    }

    if (lockScroll) {
      document.body.classList.add('overflow-hidden');
    }

    makeBackgroundInert();

    nextTick(() => {
      focusInitial();
    });
  };

  const deactivate = () => {
    if (!isActive) return;
    isActive = false;

    restoreBackground();

    if (lockScroll) {
      document.body.classList.remove('overflow-hidden');
    }

    if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus();
    }
    previouslyFocusedElement = null;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen.value) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (onClose) {
        onClose();
      }
      return;
    }

    if (event.key === 'Tab' && dialogRef.value) {
      const focusable = getFocusableElements(dialogRef.value);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (
          document.activeElement === first ||
          document.activeElement === dialogRef.value ||
          !dialogRef.value.contains(document.activeElement)
        ) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (
          document.activeElement === last ||
          !dialogRef.value.contains(document.activeElement)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  };

  watch(
    isOpen,
    (open) => {
      if (open) {
        activate();
      } else {
        deactivate();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    if (isOpen.value) {
      activate();
    }
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
    deactivate();
  });

  return {
    activate,
    deactivate,
    focusInitial,
  };
}
