import { Cinema } from '../models/Cinema.js';

export const DEMO_CINEMAS = [
  { slug: 'cine-bellecour', name: 'Ciné Bellecour', address: 'Place Bellecour', city: 'Lyon', latitude: 45.756942, longitude: 4.832981, features: ['vo'] },
  { slug: 'grand-ecran-terreaux', name: 'Le Grand Écran Terreaux', address: 'Place des Terreaux', city: 'Lyon', latitude: 45.767381, longitude: 4.833592, features: ['vo', 'dolby'] },
  { slug: 'ecrans-croix-rousse', name: 'Les Écrans de la Croix-Rousse', address: 'Place de la Croix-Rousse', city: 'Lyon', latitude: 45.774512, longitude: 4.831948, features: ['vo'] },
  { slug: 'cine-part-dieu', name: 'Ciné Part-Dieu', address: 'Place Charles Béraudier', city: 'Lyon', latitude: 45.760531, longitude: 4.859124, features: ['imax', 'dolby'] },
  { slug: 'cine-confluence', name: 'Ciné Confluence', address: 'Place Nautique', city: 'Lyon', latitude: 45.741268, longitude: 4.818347, features: ['imax'] },
  { slug: 'studio-monplaisir', name: 'Studio Monplaisir', address: 'Place Ambroise Courtois', city: 'Lyon', latitude: 45.745036, longitude: 4.870962, features: ['vo'] },
  { slug: 'cine-croix-luizet', name: 'Ciné Croix-Luizet', address: 'Avenue Roger Salengro', city: 'Villeurbanne', latitude: 45.79763, longitude: 4.88971, features: ['imax'] },
  { slug: 'cine-republique', name: 'Ciné République', address: 'Place de la République', city: 'Paris', latitude: 48.867543, longitude: 2.363982, features: ['vo', 'imax'] },
  { slug: 'cine-vieux-port', name: 'La Lanterne du Vieux-Port', address: 'Quai du Port', city: 'Marseille', latitude: 43.29517, longitude: 5.37402, features: ['dolby'] },
  { slug: 'cine-quinconces', name: 'Studio des Quinconces', address: 'Place des Quinconces', city: 'Bordeaux', latitude: 44.844512, longitude: -0.574983, features: ['vo'] },
  { slug: 'cine-grand-place', name: 'Salle Grand Place', address: 'Place du Général de Gaulle', city: 'Lille', latitude: 50.636581, longitude: 3.063472, features: ['imax'] }
];

export async function seedCinemas() {
  await Cinema.bulkWrite(DEMO_CINEMAS.map((c) => ({
    updateOne: {
      filter: { slug: c.slug },
      update: { $set: { ...c, location: { type: 'Point', coordinates: [c.longitude, c.latitude] } } },
      upsert: true
    }
  })));
}
