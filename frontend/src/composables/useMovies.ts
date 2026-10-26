import { ref, computed } from 'vue';
import axios, { type CancelTokenSource } from 'axios';
import { useMoviesStore } from '../stores/movies';

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

// Cache local pour éviter les requêtes répétées
const moviesCache = ref<Map<string, MoviesResponse>>(new Map());
const CACHE_TTL_MS = 5000; // 5 secondes

// Cache pour les détails d'un film
const movieDetailsCache = ref<Map<string, Movie>>(new Map());

export function useMovies() {
  const moviesStore = useMoviesStore();
  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const currentPage = ref(1);
  const currentLimit = ref(20);
  const hasMore = ref(false);
  
  // Gestion de l'annulation des requêtes
  const cancelTokenSource = ref<CancelTokenSource | null>(null);
  
  // Identifiant de recherche pour éviter les réponses anciennes
  const searchId = ref(0);

  // Récupérer tous les films avec filtres et pagination
  const fetchMovies = async (filters: MovieFilters = {}, resetCache: boolean = false) => {
    // Incrémenter l'identifiant de recherche pour cette nouvelle requête
    const currentSearchId = ++searchId.value;
    
    // Annuler la requête précédente si elle existe
    if (cancelTokenSource.value) {
      cancelTokenSource.value.cancel('Requête annulée - nouvelle recherche en cours');
    }
    
    // Créer un nouveau token d'annulation
    cancelTokenSource.value = axios.CancelToken.source();
    
    try {
      loading.value = true;
      error.value = null;

      // Générer la clé de cache
      const cacheKey = JSON.stringify(filters);
      
      // Vérifier le cache
      if (!resetCache && moviesCache.value.has(cacheKey)) {
        const cached = moviesCache.value.get(cacheKey)!;
        if (Date.now() - (cached as any).timestamp < CACHE_TTL_MS) {
          movies.value = cached.data;
          totalCount.value = cached.count;
          currentPage.value = cached.page;
          currentLimit.value = cached.limit;
          hasMore.value = cached.page * cached.limit < cached.count;
          loading.value = false;
          moviesStore.setMovies(cached);
          return;
        }
      }

      // Construire la query string
      const params = new URLSearchParams();
      
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.genre) {
        params.set('genre', filters.genre);
      }
      if (filters.minRating !== undefined) {
        params.set('minRating', filters.minRating.toString());
      }
      if (filters.director) {
        params.set('director', filters.director);
      }
      
      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const response = await axios.get<MoviesResponse>(`${API_BASE_URL}?${params.toString()}`, {
        cancelToken: cancelTokenSource.value.token,
      });
      
      // Vérifier que cette réponse correspond à la recherche actuelle
      // (éviter de remplacer avec une réponse ancienne)
      if (currentSearchId !== searchId.value) {
        console.log('Réponse ignorée - recherche plus récente en cours');
        return;
      }
      
      // Mettre en cache avec timestamp
      const responseWithTimestamp = {
        ...response.data,
        timestamp: Date.now(),
      };
      moviesCache.value.set(cacheKey, responseWithTimestamp);

      movies.value = response.data.data;
      totalCount.value = response.data.count;
      currentPage.value = response.data.page;
      currentLimit.value = response.data.limit;
      hasMore.value = response.data.page * response.data.limit < response.data.count;
      moviesStore.setMovies(response.data);
      
    } catch (err) {
      // Ne pas afficher d'erreur si la requête a été annulée
      if (axios.isCancel(err)) {
        console.log('Requête annulée:', err.message);
        return;
      }
      
      // Vérifier que cette erreur correspond à la recherche actuelle
      if (currentSearchId !== searchId.value) {
        console.log('Erreur ignorée - recherche plus récente en cours');
        return;
      }
      
      error.value = 'Impossible de récupérer les films. Veuillez réessayer.';
      console.error('Erreur lors de la récupération des films:', err);
    } finally {
      // Ne pas mettre loading à false si cette réponse est ancienne
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

  // Récupérer un film par ID
  const fetchMovieById = async (id: string) => {
    try {
      // Vérifier le cache
      if (movieDetailsCache.value.has(id)) {
        return movieDetailsCache.value.get(id)!;
      }

      const response = await axios.get<Movie>(`${API_BASE_URL}/${id}`);
      
      // Mettre en cache
      movieDetailsCache.value.set(id, response.data);
      
      return response.data;
    } catch (err) {
      error.value = 'Impossible de récupérer les détails du film.';
      console.error('Erreur lors de la récupération du film:', err);
      throw err;
    }
  };

  // Créer un nouveau film
  const createMovie = async (movieData: Omit<Movie, '_id'>) => {
    try {
      const response = await axios.post<Movie>(API_BASE_URL, movieData);
      
      // Invalider le cache
      moviesCache.value.clear();
      movieDetailsCache.value.clear();
      
      return response.data;
    } catch (err) {
      error.value = 'Impossible de créer le film.';
      console.error('Erreur lors de la création du film:', err);
      throw err;
    }
  };

  // Filtres courants (réactifs)
  const currentFilters = ref<MovieFilters>({});

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
    if (cancelTokenSource.value) {
      cancelTokenSource.value.cancel('Requête annulée - composant démonté');
      cancelTokenSource.value = null;
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
