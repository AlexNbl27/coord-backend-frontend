// Script d'initialisation de la base MongoDB 'cours_db'
const dbName = 'cours_db';
const targetDb = db.getSiblingDB(dbName);

// Nettoyage préalable pour éviter les doublons lors des réinitialisations
targetDb.movies.drop();
targetDb.users.drop();

const movies = [
  {
    title: "Inception",
    director: "Christopher Nolan",
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    duration: 148,
    ratings: { imdb: 8.8, rottenTomatoes: 87, votes: 2400000 },
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
    budget: 160000000,
    boxOffice: 836800000,
    availableOnStreaming: true,
    tags: ["mind-bending", "dreams", "heist"],
    reviews: [
      { user: "Alice", score: 9, comment: "Chef d'œuvre visuel et scénaristique." },
      { user: "Bob", score: 8, comment: "Un peu complexe au début mais captivant." }
    ]
  },
  {
    title: "Interstellar",
    director: "Christopher Nolan",
    year: 2014,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    duration: 169,
    ratings: { imdb: 8.7, rottenTomatoes: 73, votes: 2000000 },
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"],
    budget: 165000000,
    boxOffice: 773800000,
    availableOnStreaming: true,
    tags: ["space", "time-dilation", "black-hole"],
    reviews: [
      { user: "Claire", score: 10, comment: "Bande son légendaire de Hans Zimmer." },
      { user: "David", score: 9, comment: "Très émouvant et scientifiquement fascinant." }
    ]
  },
  {
    title: "The Matrix",
    director: "Lana Wachowski",
    year: 1999,
    genres: ["Action", "Sci-Fi"],
    duration: 136,
    ratings: { imdb: 8.7, rottenTomatoes: 83, votes: 2000000 },
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss", "Hugo Weaving"],
    budget: 63000000,
    boxOffice: 467200000,
    availableOnStreaming: false,
    tags: ["cyberpunk", "simulation", "martial-arts"],
    reviews: [
      { user: "Emma", score: 10, comment: "A révolutionné le cinéma de science-fiction." }
    ]
  },
  {
    title: "Parasite",
    director: "Bong Joon Ho",
    year: 2019,
    genres: ["Drama", "Thriller", "Comedy"],
    duration: 132,
    ratings: { imdb: 8.5, rottenTomatoes: 99, votes: 900000 },
    cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"],
    budget: 15500000,
    boxOffice: 263100000,
    availableOnStreaming: true,
    tags: ["social-commentary", "dark-comedy", "oscar-winner"],
    reviews: [
      { user: "Fabien", score: 9.5, comment: "Une mise en scène au millimètre près." }
    ]
  },
  {
    title: "Pulp Fiction",
    director: "Quentin Tarantino",
    year: 1994,
    genres: ["Crime", "Drama"],
    duration: 154,
    ratings: { imdb: 8.9, rottenTomatoes: 92, votes: 2150000 },
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson", "Bruce Willis"],
    budget: 8500000,
    boxOffice: 213900000,
    availableOnStreaming: true,
    tags: ["dialogues", "nonlinear", "cult"],
    reviews: [
      { user: "Gaelle", score: 9, comment: "Des répliques cultes à chaque scène." }
    ]
  },
  {
    title: "Spirited Away",
    director: "Hayao Miyazaki",
    year: 2001,
    genres: ["Animation", "Adventure", "Family", "Fantasy"],
    duration: 125,
    ratings: { imdb: 8.6, rottenTomatoes: 97, votes: 830000 },
    cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki"],
    budget: 19000000,
    boxOffice: 395800000,
    availableOnStreaming: true,
    tags: ["ghibli", "spirits", "japanese-animation"],
    reviews: [
      { user: "Hugo", score: 10, comment: "Un voyage onirique et poétique." }
    ]
  },
  {
    title: "The Dark Knight",
    director: "Christopher Nolan",
    year: 2008,
    genres: ["Action", "Crime", "Drama"],
    duration: 152,
    ratings: { imdb: 9.0, rottenTomatoes: 94, votes: 2800000 },
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Michael Caine"],
    budget: 185000000,
    boxOffice: 1006000000,
    availableOnStreaming: true,
    tags: ["superhero", "joker", "gotham"],
    reviews: [
      { user: "Ines", score: 10, comment: "La performance de Heath Ledger est inégalable." }
    ]
  },
  {
    title: "Whiplash",
    director: "Damien Chazelle",
    year: 2014,
    genres: ["Drama", "Music"],
    duration: 106,
    ratings: { imdb: 8.5, rottenTomatoes: 94, votes: 960000 },
    cast: ["Miles Teller", "J.K. Simmons", "Paul Reiser"],
    budget: 3300000,
    boxOffice: 49400000,
    availableOnStreaming: false,
    tags: ["jazz", "obsession", "drums"],
    reviews: [
      { user: "Julien", score: 9, comment: "Une intensité folle du début à la fin." }
    ]
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    director: "Bob Persichetti",
    year: 2018,
    genres: ["Animation", "Action", "Adventure", "Sci-Fi"],
    duration: 117,
    ratings: { imdb: 8.4, rottenTomatoes: 97, votes: 640000 },
    cast: ["Shameik Moore", "Jake Johnson", "Hailee Steinfeld", "Mahershala Ali"],
    budget: 90000000,
    boxOffice: 384300000,
    availableOnStreaming: true,
    tags: ["multiverse", "comics", "hip-hop"],
    reviews: [
      { user: "Kenza", score: 9.5, comment: "Visuellement une claque totale." }
    ]
  },
  {
    title: "Grand Budapest Hotel",
    director: "Wes Anderson",
    year: 2014,
    genres: ["Adventure", "Comedy", "Crime"],
    duration: 99,
    ratings: { imdb: 8.1, rottenTomatoes: 92, votes: 870000 },
    cast: ["Ralph Fiennes", "Tony Revolori", "Saoirse Ronan", "Willem Dafoe"],
    budget: 25000000,
    boxOffice: 173000000,
    availableOnStreaming: true,
    tags: ["symmetry", "pastel", "humour"],
    reviews: [
      { user: "Leo", score: 8.5, comment: "Esthétique unique et acteurs géniaux." }
    ]
  },
  {
    title: "Fight Club",
    director: "David Fincher",
    year: 1999,
    genres: ["Drama"],
    duration: 139,
    ratings: { imdb: 8.8, rottenTomatoes: 80, votes: 2280000 },
    cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
    budget: 63000000,
    boxOffice: 101200000,
    availableOnStreaming: false,
    tags: ["insomnia", "twist", "anti-consumerism"],
    reviews: [
      { user: "Marc", score: 9, comment: "Premier principe du Fight Club..." }
    ]
  },
  {
    title: "Forrest Gump",
    director: "Robert Zemeckis",
    year: 1994,
    genres: ["Drama", "Romance"],
    duration: 142,
    ratings: { imdb: 8.8, rottenTomatoes: 71, votes: 2200000 },
    cast: ["Tom Hanks", "Robin Wright", "Gary Sinise"],
    budget: 55000000,
    boxOffice: 678200000,
    availableOnStreaming: true,
    tags: ["historical-events", "feel-good", "running"],
    reviews: [
      { user: "Nina", score: 9.5, comment: "La vie c'est comme une boîte de chocolats." }
    ]
  }
];

targetDb.movies.insertMany(movies);

// Création des index
targetDb.movies.createIndex({ title: "text", tags: "text" });
targetDb.movies.createIndex({ genres: 1 });
targetDb.movies.createIndex({ "ratings.imdb": -1 });

// Collection utilisateurs
targetDb.users.insertMany([
  { name: 'Alice Dupont', email: 'alice@example.com', age: 24, favoriteGenres: ['Sci-Fi', 'Thriller'], city: 'Paris' },
  { name: 'Bob Martin', email: 'bob@example.com', age: 29, favoriteGenres: ['Drama', 'Crime'], city: 'Lyon' },
  { name: 'Claire Bernard', email: 'claire@example.com', age: 21, favoriteGenres: ['Animation', 'Adventure'], city: 'Marseille' },
  { name: 'David Leroy', email: 'david@example.com', age: 35, favoriteGenres: ['Action', 'Sci-Fi'], city: 'Bordeaux' }
]);

print("✅ Base 'cours_db' initialisée avec succès avec les films et les index !");
