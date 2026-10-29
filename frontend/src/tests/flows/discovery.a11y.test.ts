import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import MovieCard from '@/components/MovieCard.vue';
import SearchBar from '@/components/SearchBar.vue';
import { expectNoA11yViolations } from '../setup';

describe('Flux 1 : Découverte & Exploration des Films (A11y)', () => {
  const mockMovie = {
    _id: 'm1',
    title: 'Inception',
    director: 'Christopher Nolan',
    year: 2010,
    duration: 148,
    genres: ['Science-Fiction', 'Thriller'],
    synopsis: 'Dom Cobb est un voleur expérimenté dans l\'art de l\'extraction...',
    poster: 'https://example.com/poster.jpg',
    ratings: { imdb: 8.8 },
  };

  describe('Composant MovieCard', () => {
    it('doit être accessible au clavier avec un rôle interactif et un nom accessible complet', async () => {
      let clicked = false;
      const { container } = render(MovieCard, {
        props: {
          movie: mockMovie,
        },
        attrs: {
          onClick: () => { clicked = true; }
        }
      });

      // La carte doit être un bouton interactif ou un lien pour VoiceOver/clavier
      const cardAction = screen.getByRole('button', {
        name: /Inception/i,
      });
      expect(cardAction).toBeTruthy();

      // Le nom accessible doit contenir le titre, l'année et la note
      expect(cardAction.getAttribute('aria-label') || cardAction.textContent).toMatch(/Inception/i);
      expect(cardAction.getAttribute('aria-label') || cardAction.textContent).toMatch(/8\.8/i);

      // Activation au clavier avec Entrée ou Espace
      await userEvent.tab();
      expect(document.activeElement).toBe(cardAction);
      await userEvent.keyboard('{Enter}');
      expect(clicked).toBe(true);

      // Audit axe-core
      await expectNoA11yViolations(container);
    });

    it('doit masquer les éléments purement visuels/décoratifs (étoile, trophée) aux lecteurs d\'écran', () => {
      const { container } = render(MovieCard, {
        props: {
          movie: { ...mockMovie, ratings: { imdb: 9.0 } },
        },
      });

      // Les icônes décoratives doivent être ignorées par VoiceOver
      const decorativeIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Composant SearchBar & Filtres', () => {
    it('doit comporter un label accessible pour le champ de recherche et des selects reliés par for/id', async () => {
      const { container } = render(SearchBar, {
        props: {
          search: '',
          genre: '',
          minRating: undefined,
          availableGenres: ['Action', 'Drame', 'Comédie'],
          resultsCount: 12,
        },
      });

      // Le champ de recherche doit avoir un label accessible pour VoiceOver
      const searchInput = screen.getByRole('searchbox', {
        name: /rechercher/i,
      });
      expect(searchInput).toBeTruthy();

      // Le bouton d'ouverture des filtres doit avoir aria-expanded
      const filterButton = screen.getByRole('button', {
        name: /filtres/i,
      });
      expect(filterButton.getAttribute('aria-expanded')).toBe('false');

      // Cliquer pour ouvrir les filtres
      await userEvent.click(filterButton);
      expect(filterButton.getAttribute('aria-expanded')).toBe('true');

      // Les select doivent avoir des labels explicites associés
      const genreSelect = screen.getByRole('combobox', {
        name: /genre/i,
      });
      expect(genreSelect).toBeTruthy();
      expect(genreSelect.getAttribute('id')).toBeTruthy();

      const ratingSelect = screen.getByRole('combobox', {
        name: /note/i,
      });
      expect(ratingSelect).toBeTruthy();

      // Une région aria-live doit annoncer dynamiquement le nombre de résultats
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent).toMatch(/12/);

      // Audit axe-core
      await expectNoA11yViolations(container);
    });
  });
});

