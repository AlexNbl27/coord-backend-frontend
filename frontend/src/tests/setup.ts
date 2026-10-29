import { expect } from 'vitest';
import axe from 'axe-core';
import { config } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// Configurer Pinia par défaut pour les tests de composants Vue
const pinia = createPinia();
setActivePinia(pinia);
config.global.plugins = [pinia];
config.global.stubs = {
  'router-link': {
    template: '<a :href="to || \'#\'" :aria-label="$attrs[\'aria-label\']" :class="$attrs.class" :title="$attrs.title"><slot /></a>',
    props: ['to'],
  },
  'router-view': {
    template: '<div id="router-view-stub"><slot /></div>',
  },
};

// Configuration utilitaire pour axe-core
export async function expectNoA11yViolations(
  container: Element | Document,
  options?: axe.RunOptions
) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    rules: {
      // Les tests dans JSDOM n'ont pas de moteur de rendu CSS complet (couleurs réelles)
      'color-contrast': { enabled: false },
      ...options?.rules,
    },
    ...options,
  });

  const violations = results.violations;
  if (violations.length > 0) {
    const errorMessages = violations.map(v => {
      const targets = v.nodes.map(n => n.target.join(' ')).join('\n   - ');
      return `[${v.impact?.toUpperCase()}] ${v.id}: ${v.help}\n   Guides: ${v.helpUrl}\n   Cibles concernées:\n   - ${targets}`;
    }).join('\n\n');

    expect.fail(`Des violations d'accessibilité (axe-core) ont été détectées :\n\n${errorMessages}`);
  }
}

// Polyfills JSDOM pour l'accessibilité et les APIs de navigateur
if (typeof window !== 'undefined') {
  // matchMedia (ex: prefers-reduced-motion)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };

  // scrollIntoView
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}

