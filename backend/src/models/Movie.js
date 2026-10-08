import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: { type: String, required: true },
  score: { type: Number, min: 0, max: 10 },
  comment: { type: String }
}, { _id: false });

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le titre est obligatoire'],
    trim: true
  },
  director: {
    type: String,
    required: [true, 'Le réalisateur est obligatoire'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, "L'année de sortie est obligatoire"]
  },
  genres: [{
    type: String,
    trim: true
  }],
  duration: {
    type: Number, // en minutes
    min: 1
  },
  ratings: {
    imdb: { type: Number, min: 0, max: 10 },
    rottenTomatoes: { type: Number, min: 0, max: 100 },
    votes: { type: Number, default: 0 }
  },
  cast: [{
    type: String,
    trim: true
  }],
  budget: { type: Number },
  boxOffice: { type: Number },
  availableOnStreaming: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  reviews: [reviewSchema]
}, {
  timestamps: true,
  collection: 'movies'
});

// Index B-Tree pour accélérer les requêtes de filtrage et de tri du test de charge
movieSchema.index({ genres: 1, 'ratings.imdb': -1 });
movieSchema.index({ year: -1 });
movieSchema.index({ 'ratings.imdb': -1 });

export const Movie = mongoose.model('Movie', movieSchema);

