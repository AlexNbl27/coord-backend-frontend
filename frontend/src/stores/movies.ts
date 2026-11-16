import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Movie, MoviesResponse } from '../composables/useMovies';

export const useMoviesStore = defineStore('movies', () => {
  // État
  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const currentPage = ref(1);
  const currentLimit = ref(20);
  const searchQuery = ref('');
  const selectedGenre = ref<string | undefined>(undefined);
  const minRating = ref<number | undefined>(undefined);

  // Getters
  const hasMovies = computed(() => movies.value.length > 0);
  const hasMore = computed(() => currentPage.value * currentLimit.value < totalCount.value);
  const filteredMovies = computed(() => {
    let result = [...movies.value];
    
    // Filtrer par recherche
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(movie => 
        movie.title.toLowerCase().includes(query) ||
        movie.director?.toLowerCase().includes(query) ||
        movie.genres?.some(g => g.toLowerCase().includes(query)) ||
        movie.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Filtrer par genre
    if (selectedGenre.value) {
      result = result.filter(movie => 
        movie.genres?.includes(selectedGenre.value!)
      );
    }
    
    // Filtrer par note minimale
    if (minRating.value !== undefined) {
      result = result.filter(movie => 
        movie.ratings?.imdb >= minRating.value!
      );
    }
    
    return result;
  });

  const availableGenres = computed(() => {
    const genresSet = new Set<string>();
    movies.value.forEach(movie => {
      movie.genres?.forEach(genre => genresSet.add(genre));
    });
    return Array.from(genresSet).sort();
  });

  const popularMovies = computed(() => {
    return movies.value.filter(movie => movie.ratings?.imdb >= 8.5).slice(0, 6);
  });

  const recentMovies = computed(() => {
    return movies.value
      .filter(movie => movie.year >= 2020)
      .sort((a, b) => b.year - a.year)
      .slice(0, 6);
  });

  // Actions
  const setMovies = (data: MoviesResponse) => {
    movies.value = data.data;
    totalCount.value = data.count;
    currentPage.value = data.page;
    currentLimit.value = data.limit;
  };

  const addMovie = (movie: Movie) => {
    movies.value = [movie, ...movies.value];
    totalCount.value += 1;
  };

  const updateMovie = (updatedMovie: Movie) => {
    const index = movies.value.findIndex(m => m._id === updatedMovie._id);
    if (index !== -1) {
      movies.value[index] = updatedMovie;
    }
  };

  const removeMovie = (id: string) => {
    movies.value = movies.value.filter(movie => movie._id !== id);
    totalCount.value -= 1;
  };

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
  };

  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
  };

  const setSelectedGenre = (genre: string | undefined) => {
    selectedGenre.value = genre;
  };

  const setMinRating = (rating: number | undefined) => {
    minRating.value = rating;
  };

  const resetFilters = () => {
    searchQuery.value = '';
    selectedGenre.value = undefined;
    minRating.value = undefined;
  };

  const nextPage = () => {
    if (hasMore.value) {
      currentPage.value += 1;
    }
  };

  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value -= 1;
    }
  };

  const setPage = (page: number) => {
    currentPage.value = page;
  };

  const setLimit = (limit: number) => {
    currentLimit.value = limit;
    currentPage.value = 1;
  };

  return {
    movies,
    loading,
    error,
    totalCount,
    currentPage,
    currentLimit,
    searchQuery,
    selectedGenre,
    minRating,
    hasMovies,
    hasMore,
    filteredMovies,
    availableGenres,
    popularMovies,
    recentMovies,
    setMovies,
    addMovie,
    updateMovie,
    removeMovie,
    setLoading,
    setError,
    setSearchQuery,
    setSelectedGenre,
    setMinRating,
    resetFilters,
    nextPage,
    prevPage,
    setPage,
    setLimit,
  };
});
