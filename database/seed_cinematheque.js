// Script de seed enrichi pour CinéSlot
const dbName = 'cours_db';
const targetDb = db.getSiblingDB(dbName);

// Nettoyage complet
targetDb.movies.drop();
targetDb.slots.drop();

const now = new Date();
const formatIso = (hoursFromNow) => {
  const d = new Date(now.getTime() + hoursFromNow * 3600 * 1000);
  return d.toISOString();
};

const movies = [
  {
    title: "Interstellar",
    director: "Christopher Nolan",
    year: 2014,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    duration: 169,
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    ratings: { imdb: 8.7, rottenTomatoes: 73, votes: 2000000 },
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"],
    budget: 165000000,
    boxOffice: 773800000,
    availableOnStreaming: true,
    tags: ["space", "time-dilation", "black-hole", "imax"],
    synopsis: "Dans un futur proche, la Terre est devenue hostile pour l'homme. Une équipe d'explorateurs franchit un trou de ver pour trouver un nouveau foyer à l'humanité.",
    reviews: [
      { user: "Claire", score: 10, comment: "Bande son légendaire de Hans Zimmer et visuel époustouflant." },
      { user: "David", score: 9, comment: "Très émouvant et scientifiquement fascinant." }
    ]
  },
  {
    title: "Inception",
    director: "Christopher Nolan",
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    duration: 148,
    poster: "https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
    ratings: { imdb: 8.8, rottenTomatoes: 87, votes: 2400000 },
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
    budget: 160000000,
    boxOffice: 836800000,
    availableOnStreaming: true,
    tags: ["mind-bending", "dreams", "heist"],
    synopsis: "Dom Cobb est un voleur expérimenté capable de s'infiltrer dans les rêves. On lui propose une mission inverse : implanter une idée dans l'esprit d'un héritier.",
    reviews: [
      { user: "Alice", score: 9, comment: "Chef d'œuvre visuel et scénaristique." },
      { user: "Bob", score: 8.5, comment: "Un concept génial mené tambour battant." }
    ]
  },
  {
    title: "The Dark Knight",
    director: "Christopher Nolan",
    year: 2008,
    genres: ["Action", "Crime", "Drama"],
    duration: 152,
    poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    ratings: { imdb: 9.0, rottenTomatoes: 94, votes: 2800000 },
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Michael Caine"],
    budget: 185000000,
    boxOffice: 1006000000,
    availableOnStreaming: true,
    tags: ["superhero", "joker", "gotham", "masterpiece"],
    synopsis: "Batman entreprend de démanteler les organisations criminelles de Gotham avec l'aide du lieutenant Jim Gordon et du procureur Harvey Dent, jusqu'à l'arrivée du Joker.",
    reviews: [
      { user: "Hugo", score: 10, comment: "Heath Ledger livre la performance de sa vie." }
    ]
  },
  {
    title: "Dune : Deuxième Partie",
    director: "Denis Villeneuve",
    year: 2024,
    genres: ["Action", "Adventure", "Sci-Fi"],
    duration: 166,
    poster: "https://image.tmdb.org/t/p/w500/czembW0Rk1Ke7lCJGahbOhdCuhV.jpg",
    ratings: { imdb: 8.6, rottenTomatoes: 92, votes: 520000 },
    cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Javier Bardem"],
    budget: 190000000,
    boxOffice: 711800000,
    availableOnStreaming: true,
    tags: ["desert", "worms", "prophecy", "imax"],
    synopsis: "Paul Atreides s'unit à Chani et aux Fremen pour mener la révolte contre ceux qui ont anéanti sa famille, tout en affrontant un choix déchirant entre amour et destin.",
    reviews: [
      { user: "Sarah", score: 9.5, comment: "Une claque visuelle et sonore monumentale." }
    ]
  },
  {
    title: "The Matrix",
    director: "Lana Wachowski",
    year: 1999,
    genres: ["Action", "Sci-Fi"],
    duration: 136,
    poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    ratings: { imdb: 8.7, rottenTomatoes: 83, votes: 2000000 },
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss", "Hugo Weaving"],
    budget: 63000000,
    boxOffice: 467200000,
    availableOnStreaming: false,
    tags: ["cyberpunk", "simulation", "martial-arts"],
    synopsis: "Un hacker informatique nommé Neo découvre que la réalité telle qu'il la perçoit n'est qu'une simulation virtuelle créée par des machines pour asservir l'humanité.",
    reviews: [
      { user: "Emma", score: 10, comment: "A révolutionné le cinéma de science-fiction moderne." }
    ]
  },
  {
    title: "Parasite",
    director: "Bong Joon Ho",
    year: 2019,
    genres: ["Drama", "Thriller", "Comedy"],
    duration: 132,
    poster: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    ratings: { imdb: 8.5, rottenTomatoes: 99, votes: 900000 },
    cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"],
    budget: 15500000,
    boxOffice: 263100000,
    availableOnStreaming: true,
    tags: ["social-commentary", "dark-comedy", "oscar-winner"],
    synopsis: "Toute la famille de Ki-taek est au chômage. L'opportunité d'infiltrer la richissime famille Park va déclencher un enchaînement d'événements incontrôlables.",
    reviews: [
      { user: "Fabien", score: 9.5, comment: "Une mise en scène virtuose au millimètre près." }
    ]
  },
  {
    title: "Pulp Fiction",
    director: "Quentin Tarantino",
    year: 1994,
    genres: ["Crime", "Drama"],
    duration: 154,
    poster: "https://image.tmdb.org/t/p/w500/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg",
    ratings: { imdb: 8.9, rottenTomatoes: 92, votes: 2150000 },
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson", "Bruce Willis"],
    budget: 8500000,
    boxOffice: 213900000,
    availableOnStreaming: true,
    tags: ["dialogues", "nonlinear", "cult"],
    synopsis: "Les destins entrecroisés de deux tueurs à gages, d'un boxeur en cavale, de la femme d'un parrain et d'un couple de braqueurs à Los Angeles.",
    reviews: [
      { user: "Gaelle", score: 9, comment: "Des répliques cultes à chaque scène." }
    ]
  },
  {
    title: "Oppenheimer",
    director: "Christopher Nolan",
    year: 2023,
    genres: ["Biography", "Drama", "History"],
    duration: 180,
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    ratings: { imdb: 8.9, rottenTomatoes: 93, votes: 750000 },
    cast: ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr."],
    budget: 100000000,
    boxOffice: 957000000,
    availableOnStreaming: true,
    tags: ["manhattan-project", "atomic-bomb", "history", "biopic"],
    synopsis: "Pendant la Seconde Guerre mondiale, le physicien J. Robert Oppenheimer dirige le Projet Manhattan à Los Alamos pour créer la première arme nucléaire.",
    reviews: [
      { user: "Julien", score: 9.5, comment: "Intense, tragique et magistralement interprété." }
    ]
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    director: "Bob Persichetti",
    year: 2018,
    genres: ["Animation", "Action", "Adventure"],
    duration: 117,
    poster: "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    ratings: { imdb: 8.4, rottenTomatoes: 97, votes: 650000 },
    cast: ["Shameik Moore", "Jake Johnson", "Hailee Steinfeld", "Mahershala Ali"],
    budget: 90000000,
    boxOffice: 375500000,
    availableOnStreaming: true,
    tags: ["multiverse", "comics", "innovative-animation"],
    synopsis: "Miles Morales, adolescent de Brooklyn, se découvre des pouvoirs arachnéens et rencontre d'autres versions de Spider-Man venues de dimensions parallèles.",
    reviews: [
      { user: "Maxime", score: 9.5, comment: "Une révolution visuelle pour le cinéma d'animation." }
    ]
  },
  {
    title: "Whiplash",
    director: "Damien Chazelle",
    year: 2014,
    genres: ["Drama", "Music"],
    duration: 106,
    poster: "https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
    ratings: { imdb: 8.5, rottenTomatoes: 94, votes: 980000 },
    cast: ["Miles Teller", "J.K. Simmons", "Paul Reiser"],
    budget: 3300000,
    boxOffice: 49000000,
    availableOnStreaming: false,
    tags: ["jazz", "perfectionism", "drums", "intensity"],
    synopsis: "Un jeune batteur de jazz intègre le meilleur conservatoire des États-Unis et subit les méthodes d'enseignement impitoyables de son professeur.",
    reviews: [
      { user: "Thomas", score: 10, comment: "Un duel psychologique à couper le souffle." }
    ]
  },
  {
    title: "Spirited Away",
    director: "Hayao Miyazaki",
    year: 2001,
    genres: ["Animation", "Adventure", "Family", "Fantasy"],
    duration: 125,
    poster: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    ratings: { imdb: 8.6, rottenTomatoes: 97, votes: 830000 },
    cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki"],
    budget: 19000000,
    boxOffice: 395800000,
    availableOnStreaming: true,
    tags: ["ghibli", "magic", "spirit-world", "anime"],
    synopsis: "Chihiro, dix ans, pénètre dans un monde peuplé d'esprits magiques. Elle doit trouver le courage de sauver ses parents transformés en porcs.",
    reviews: [
      { user: "Lea", score: 10, comment: "La poésie à l'état pur." }
    ]
  },
  {
    title: "Fight Club",
    director: "David Fincher",
    year: 1999,
    genres: ["Drama"],
    duration: 139,
    poster: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    ratings: { imdb: 8.8, rottenTomatoes: 79, votes: 2280000 },
    cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter", "Meat Loaf"],
    budget: 63000000,
    boxOffice: 101200000,
    availableOnStreaming: true,
    tags: ["insomnia", "anarchy", "cult-classic"],
    synopsis: "Un employé de bureau désabusé et insomniaque rencontre Tyler Durden, un vendeur de savon charismatique avec qui il fonde un club de combat clandestin.",
    reviews: [
      { user: "Arthur", score: 9.5, comment: "Scénario et ambiance incomparables." }
    ]
  }
];

targetDb.movies.insertMany(movies);

// Création des index optimisés
targetDb.movies.createIndex({ title: 1 });
targetDb.movies.createIndex({ "ratings.imdb": -1 });
targetDb.movies.createIndex({ genres: 1 });
targetDb.movies.createIndex({ year: -1 });

// Initialisation des séances de cinéma
const slots = [
  {
    _id: "slot-interstellar-imax-1",
    startsAt: formatIso(2),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Interstellar",
    hall: "Salle 1 · IMAX Laser 4K",
    claimCount: 0
  },
  {
    _id: "slot-inception-dolby-1",
    startsAt: formatIso(4),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Inception",
    hall: "Salle 2 · Dolby Atmos",
    claimCount: 0
  },
  {
    _id: "slot-dune2-imax-1",
    startsAt: formatIso(6),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Dune : Deuxième Partie",
    hall: "Salle 1 · IMAX Laser 4K",
    claimCount: 0
  },
  {
    _id: "slot-darkknight-70mm-1",
    startsAt: formatIso(8),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "The Dark Knight",
    hall: "Salle 3 · 70mm Grand Large",
    claimCount: 0
  },
  {
    _id: "slot-oppenheimer-70mm-1",
    startsAt: formatIso(24),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Oppenheimer",
    hall: "Salle 3 · 70mm Grand Large",
    claimCount: 0
  },
  {
    _id: "slot-matrix-retro-1",
    startsAt: formatIso(26),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "The Matrix",
    hall: "Salle 5 · Rétro Culte",
    claimCount: 0
  },
  {
    _id: "slot-pulp-dolby-1",
    startsAt: formatIso(28),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Pulp Fiction",
    hall: "Salle 4 · Dolby Cinema",
    claimCount: 0
  },
  {
    _id: "slot-parasite-dolby-1",
    startsAt: formatIso(30),
    status: "AVAILABLE",
    version: NumberLong(0),
    movieTitle: "Parasite",
    hall: "Salle 2 · Dolby Atmos",
    claimCount: 0
  }
];

targetDb.slots.insertMany(slots);

print("Seed Cinémathèque terminé avec succès !");
print("Films insérés : " + targetDb.movies.countDocuments());
print("Séances insérées : " + targetDb.slots.countDocuments());
