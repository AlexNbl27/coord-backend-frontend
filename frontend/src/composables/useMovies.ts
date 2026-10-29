import { ref, computed } from 'vue';
import axios from 'axios';
import { apiClient } from '../services/apiClient';
import { cacheManager, CacheKeys } from '../services/cacheManager';
import { useMoviesStore } from '../stores/movies';
import { useConnection } from './useConnection';

// Interface pour un film
export interface Movie {
  _id: string;
  title: string;
  director: string;
  year: number;
  genres: string[];
  duration: number;
  ratings: {
    imdb: number;
    rottenTomatoes?: number;
    votes?: number;
  };
  cast?: string[];
  budget?: number;
  boxOffice?: number;
  availableOnStreaming?: boolean;
  tags?: string[];
  synopsis?: string;
  poster?: string;
  reviews?: Array<{
    user: string;
    score: number;
    comment: string;
  }>;
}

// Interface pour la réponse de l'API avec pagination
export interface MoviesResponse {
  count: number;
  total?: number;
  page: number;
  limit: number;
  data: Movie[];
}

// Interface pour les filtres
export interface MovieFilters {
  search?: string;
  genre?: string;
  minRating?: number;
  director?: string;
  page?: number;
  limit?: number;
}

// URL de base de l'API (utilise le proxy Vite en développement)
const API_BASE_URL = '/api/movies';

// Cache mémoire LRU (max 25 entrées)
const MAX_CACHE_ENTRIES = 25;
const moviesCache = ref<Map<string, MoviesResponse & { timestamp: number }>>(new Map());
const CACHE_TTL_MS = 15000; // 15 secondes en mémoire

// Cache mémoire pour les détails d'un film
const movieDetailsCache = ref<Map<string, Movie>>(new Map());

// Chargement initial depuis le cache persistant si existant
const initialCachedMovies = cacheManager.get<MoviesResponse>(CacheKeys.MOVIES);

export function useMovies() {
  const moviesStore = useMoviesStore();
  const movies = ref<Movie[]>(initialCachedMovies?.data.data || []);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(initialCachedMovies?.data.total || initialCachedMovies?.data.count || 0);
  const currentPage = ref(initialCachedMovies?.data.page || 1);
  const currentLimit = ref(initialCachedMovies?.data.limit || 20);
  const hasMore = ref(false);
  const isFromCache = ref(false);

  // Initialise le store avec le cache persistant s'il est vide
  if (initialCachedMovies?.data && moviesStore.movies.length === 0) {
    moviesStore.setMovies(initialCachedMovies.data);
  }
  
  // Gestion standard de l'annulation des requêtes réseau
  let activeAbortController: AbortController | null = null;
  
  // Identifiant de recherche pour éviter les réponses obsolètes
  const searchId = ref(0);

  // Filtres courants (réactifs)
  const currentFilters = ref<MovieFilters>({});

  // Enregistrement de la resynchronisation automatique au retour du backend
  try {
    const { onReconnectSync } = useConnection();
    onReconnectSync(async () => {
      console.log('[useMovies] Reconnexion détectée, rafraîchissement des films en tâche de fond...');
      await fetchMovies(currentFilters.value, true);
    });
  } catch {
    // Si hors contexte Vue
  }

  // Récupérer tous les films avec filtres et pagination
  const fetchMovies = async (filters: MovieFilters = {}, resetCache: boolean = false) => {
    const currentSearchId = ++searchId.value;
    
    // Annuler la requête précédente si elle est toujours en transit
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    
    try {
      loading.value = true;
      error.value = null;

      // Générer la clé de cache mémoire
      const cacheKey = JSON.stringify(filters);
      
      // Vérifier le cache mémoire
      if (!resetCache && moviesCache.value.has(cacheKey)) {
        const cached = moviesCache.value.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          movies.value = cached.data;
          totalCount.value = cached.total ?? cached.count;
          currentPage.value = cached.page;
          currentLimit.value = cached.limit;
          hasMore.value = cached.page * cached.limit < totalCount.value;
          loading.value = false;
          isFromCache.value = true;
          moviesStore.setMovies(cached);
          return;
        }
      }

      // Construire la query string
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.minRating !== undefined) params.set('minRating', filters.minRating.toString());
      if (filters.director) params.set('director', filters.director);
      
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const response = await apiClient.get<MoviesResponse>(`${API_BASE_URL}?${params.toString()}`, {
        signal: activeAbortController.signal,
      });
      
      // Vérifier que cette réponse correspond bien à la dernière recherche demandée
      if (currentSearchId !== searchId.value) {
        return;
      }
      
      // Éviction LRU en mémoire
      if (moviesCache.value.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = moviesCache.value.keys().next().value;
        if (oldestKey) moviesCache.value.delete(oldestKey);
      }

      // Mettre en cache mémoire avec timestamp
      const responseWithTimestamp = {
        ...response.data,
        timestamp: Date.now(),
      };
      moviesCache.value.set(cacheKey, responseWithTimestamp);

      // Persistance dans le cache local (valide 10 minutes)
      cacheManager.set(CacheKeys.MOVIES, response.data, 10 * 60 * 1000);

      const effectiveTotal = response.data.total ?? response.data.count;
      movies.value = response.data.data;
      totalCount.value = effectiveTotal;
      currentPage.value = response.data.page;
      currentLimit.value = response.data.limit;
      hasMore.value = response.data.page * response.data.limit < effectiveTotal;
      isFromCache.value = false;
      moviesStore.setMovies(response.data);
      
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      
      if (currentSearchId !== searchId.value) {
        return;
      }

      // Repli fluide sur le cache persistant
      const persistentCache = cacheManager.get<MoviesResponse>(CacheKeys.MOVIES);
      if (persistentCache && persistentCache.data.data?.length > 0) {
        console.warn('[useMovies] Backend indisponible. Utilisation fluide du cache persistant local.');
        const cachedData = persistentCache.data;
        movies.value = cachedData.data;
        totalCount.value = cachedData.total ?? cachedData.count;
        currentPage.value = cachedData.page;
        currentLimit.value = cachedData.limit;
        hasMore.value = false;
        isFromCache.value = true;
        moviesStore.setMovies(cachedData);
        // On n'affiche pas d'erreur rouge bloquante, le mode dégradé prend le relais
        error.value = null;
        return;
      }
      
      error.value = 'Impossible de récupérer les films. Mode hors-ligne sans cache.';
      console.error('Erreur lors de la récupération des films:', err);
    } finally {
      if (currentSearchId === searchId.value) {
        loading.value = false;
      }
    }
  };

  // Charger plus de films (pagination infinie)
  const loadMore = async () => {
    if (loading.value || !hasMore.value) return;
    
    await fetchMovies({
      search: currentFilters.value.search,
      genre: currentFilters.value.genre,
      minRating: currentFilters.value.minRating,
      director: currentFilters.value.director,
      page: currentPage.value + 1,
      limit: currentLimit.value,
    });
  };

  // Récupérer un film par ID avec résilience
  const fetchMovieById = async (id: string) => {
    try {
      // 1. Vérifier le cache mémoire
      if (movieDetailsCache.value.has(id)) {
        return movieDetailsCache.value.get(id)!;
      }

      // 2. Vérifier le cache persistant
      const cachedDetail = cacheManager.get<Movie>(`${CacheKeys.MOVIE_DETAIL_PREFIX}${id}`);
      if (cachedDetail && !cachedDetail.isStale) {
        movieDetailsCache.value.set(id, cachedDetail.data);
        return cachedDetail.data;
      }

      // 3. Appel API
      const response = await apiClient.get<Movie>(`${API_BASE_URL}/${id}`);
      
      movieDetailsCache.value.set(id, response.data);
      cacheManager.set(`${CacheKeys.MOVIE_DETAIL_PREFIX}${id}`, response.data, 15 * 60 * 1000);
      
      return response.data;
    } catch (err) {
      // Repli 1 : Cache persistant même si stale
      const staleDetail = cacheManager.get<Movie>(`${CacheKeys.MOVIE_DETAIL_PREFIX}${id}`);
      if (staleDetail) {
        console.warn(`[useMovies] Utilisation du cache hors-ligne pour le film ${id}`);
        return staleDetail.data;
      }

      // Repli 2 : Recherche dans le catalogue de films déjà en mémoire
      const inStore = moviesStore.movies.find(m => m._id === id);
      if (inStore) {
        console.warn(`[useMovies] Détail retrouvé dans le store pour le film ${id}`);
        return inStore;
      }

      error.value = 'Impossible de récupérer les détails du film.';
      console.error('Erreur lors de la récupération du film:', err);
      throw err;
    }
  };

  // Créer un nouveau film
  const createMovie = async (movieData: Omit<Movie, '_id'>) => {
    try {
      const response = await apiClient.post<Movie>(API_BASE_URL, movieData);
      
      // Invalider le cache
      moviesCache.value.clear();
      movieDetailsCache.value.clear();
      cacheManager.remove(CacheKeys.MOVIES);
      
      return response.data;
    } catch (err) {
      error.value = 'Impossible de créer le film.';
      console.error('Erreur lors de la création du film:', err);
      throw err;
    }
  };

  // Filtrer les films par genre
  const filterByGenre = (genre: string | undefined) => {
    currentFilters.value.genre = genre;
    currentFilters.value.page = 1;
    fetchMovies(currentFilters.value, true);
  };

  // Filtrer par note minimale
  const filterByRating = (minRating: number | undefined) => {
    currentFilters.value.minRating = minRating;
    currentFilters.value.page = 1;
    fetchMovies(currentFilters.value, true);
  };

  // Recherche textuelle
  const searchMovies = (searchTerm: string | undefined) => {
    currentFilters.value.search = searchTerm;
    currentFilters.value.page = 1;
    fetchMovies(currentFilters.value, true);
  };

  // Réinitialiser les filtres
  const resetFilters = () => {
    currentFilters.value = {};
    fetchMovies({}, true);
  };

  // Filtres disponibles (extrait des films)
  const getAvailableGenres = computed(() => {
    const genresSet = new Set<string>();
    movies.value.forEach(movie => {
      movie.genres?.forEach(genre => genresSet.add(genre));
    });
    return Array.from(genresSet).sort();
  });

  // Annuler la requête en cours
  const cancelCurrentRequest = () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  };

  // Films filtrés par note minimale
  const getMoviesByRating = (minRating: number) => {
    return movies.value.filter(movie => movie.ratings?.imdb >= minRating);
  };

  // Films populaires (note >= 8.5)
  const popularMovies = computed(() => {
    return movies.value.filter(movie => movie.ratings?.imdb >= 8.5);
  });

  // Films récents (année >= 2020)
  const recentMovies = computed(() => {
    return movies.value.filter(movie => movie.year >= 2020);
  });

  // Films par réalisateur
  const getMoviesByDirector = (director: string) => {
    return movies.value.filter(movie => 
      movie.director?.toLowerCase().includes(director.toLowerCase())
    );
  };

  return {
    movies,
    loading,
    error,
    totalCount,
    currentPage,
    currentLimit,
    hasMore,
    isFromCache,
    currentFilters,
    getAvailableGenres,
    fetchMovies,
    loadMore,
    fetchMovieById,
    createMovie,
    filterByGenre,
    filterByRating,
    searchMovies,
    resetFilters,
    popularMovies,
    recentMovies,
    getMoviesByDirector,
    cancelCurrentRequest,
    searchId,
  };
}
