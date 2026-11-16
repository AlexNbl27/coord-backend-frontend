# GEOLOC.md — CinéSlot (Trouver un cinéma à moins de 5 km)

Le TP MediSlot est transposé à CinéSlot : « un praticien à moins de 5 km » devient **un cinéma à moins de 5 km**. La page `/cinemas` (lien « Cinémas » de la barre de navigation) propose « Autour de moi (5 km) » et « ou une adresse, un code postal ». L'API mesure, trie et pagine, MongoDB filtre vite, et la position n'est gardée nulle part.

Le kit de départ (`Kit_TP_Geolocalisation_praticiens_depart.zip`) n'était pas fourni : tout est écrit à partir du cours, dans la pile du projet (Express + MongoDB au lieu de Spring + PostgreSQL).

| MediSlot (kit) | CinéSlot |
| --- | --- |
| `DirectoryController`, `GET /api/professionals` | `backend/src/routes/cinemaRoutes.js`, `GET /api/cinemas` |
| `NearbyQuery`, `NearbyService`, `ORDER` | `backend/src/routes/cinemaRoutes.js` (`parseCinemaQuery`, `searchNearby`, `byDistance`) |
| `GeoDistance`, `BoundingBox` | `backend/src/geo/distance.js` |
| `BoxNearbyFinder`, `findInBox` | `backend/src/geo/finders.js` (`findInBox`, `keepInRadius`) |
| Migration V2 + praticiens de démo | `backend/src/models/Cinema.js` + `backend/src/geo/cinemas.js` (11 cinémas fictifs, insérés au démarrage) |
| spécialité (`specialty`) | équipement (`feature` : `imax`, `dolby`, `vo`) |
| Défi PostGIS | index `2dsphere` + `$geoNear` (`GEO_FINDER=geonear`) |
| `geo.ts`, `NearbyBar.vue`, `NearbyMap.vue` | `frontend/src/services/geo.ts`, `frontend/src/components/NearbyBar.vue`, `frontend/src/components/NearbyMap.vue`, `frontend/src/views/CinemasView.vue` |
| `frontend/nginx.conf` | `frontend/nginx.conf` |

Lancer : `docker compose up -d --build`, puis http://localhost:3001/cinemas.

---

## §1 · Le contrat

```
GET /api/cinemas?lat=45.758&lon=4.832&radiusKm=5&feature=imax&page=1&limit=6
```

Avec `lat` et `lon`, c'est une recherche « autour de ». Sans eux, c'est l'annuaire complet trié par nom (`distanceKm: null`). La forme de page est celle de `GET /api/movies` : `{ page, limit, total, data }`.

| Paramètre | Unité | Bornes | Si absent | Refus (400) |
| --- | --- | --- | --- | --- |
| `lat` | degrés décimaux WGS 84 | -90 à 90, fini | annuaire | « Indiquez lat et lon ensemble. » · « Latitude invalide : entre -90 et 90 degrés. » |
| `lon` | degrés décimaux WGS 84 | -180 à 180, fini | annuaire | « Indiquez lat et lon ensemble. » · « Longitude invalide : entre -180 et 180 degrés. » |
| `radiusKm` | kilomètres | plus de 0, au plus 20 | 5 | « Rayon invalide : plus de 0 et au plus 20 km. » |
| `feature` | code | `imax`, `dolby`, `vo` | tous | « Équipement invalide : imax, dolby, vo. » |
| `page`, `limit` | entiers | page ≥ 1, limit de 1 à 50 | 1 et 6 | « Pagination invalide : page à partir de 1, limit de 1 à 50. » |
| valeur non numérique (`lat=abc`, `lat=NaN`) | | | | « Paramètre invalide : lat. » (la valeur n'est jamais recopiée) |

- **Format des refus** : `application/problem+json` (RFC 9457), comme le billet PDF. Le front affiche `detail` tel quel.
- **Ordre des refus** : lat et lon ensemble, latitude, longitude, rayon, équipement, pagination. Tout est vérifié avant la moindre requête MongoDB (vérifié par test). `radiusKm` sans `lat` ni `lon` est refusé.
- **`Infinity` et `NaN`** : `Number('Infinity')` passe la conversion, `Number.isFinite` le refuse.
- **Réponse** : chaque cinéma porte `latitude` et `longitude` (adresse publique du cinéma, utile pour la carte) et `distanceKm`, à vol d'oiseau, **arrondie au dixième**. La position reçue n'est jamais renvoyée. En-tête `Cache-Control: no-store`.
- **Tri** : distance **exacte** croissante, puis nom, puis slug. Il porte sur tout le cercle, avant la découpe de la page, donc un cinéma n'apparaît que sur une seule page. Le front ne trie rien. Exemple réel : Ciné Confluence (2,090 km) et Ciné Part-Dieu (2,142 km) affichent tous deux « 2,1 km », et restent dans le bon ordre.
- **`total`** : nombre de cinémas dans le rayon.
- **Ordre des nombres** : latitude puis longitude dans le contrat, l'API Geolocation et Leaflet. Longitude puis latitude dans GeoJSON (réponse du géocodeur, champ `location`, `$geoNear`).

## §2 · Côté front

**Position du navigateur** (`getPosition`, `services/geo.ts`)

- Demandée **seulement après un clic** sur « Autour de moi », jamais au montage de la page (test « ne demande rien au montage »).
- Hors contexte sécurisé (`isSecureContext` faux), refus immédiat sans interroger le navigateur.
- Options : `enableHighAccuracy: false` (5 km : pas besoin du GPS), `timeout: 10 000` ms, `maximumAge: 300 000` ms.
- Arrondie à **3 décimales** (environ 111 m) dès réception : la précision au mètre ne quitte pas le navigateur.
- Au-delà de 1 km d'incertitude (`accuracy`), la page affiche « Position approximative (± x km) ».
- Le centre reste en mémoire (`ref`) : ni dans l'URL de la page, ni dans `localStorage`.

**Un message par refus** : chaque échec affiche un message (`role="alert"`) et place le focus sur le champ d'adresse.

| Cas | Message |
| --- | --- |
| code 1, `PERMISSION_DENIED` | Localisation refusée. Saisissez une adresse ou un code postal. |
| code 2, `POSITION_UNAVAILABLE` | Position introuvable pour le moment. Saisissez une adresse. |
| code 3, `TIMEOUT` | La localisation prend trop de temps. Réessayez ou saisissez une adresse. |
| page non sécurisée | La localisation exige une page sécurisée (HTTPS). Saisissez une adresse ou un code postal. |
| pas d'API Geolocation | Votre navigateur ne sait pas donner votre position. Saisissez une adresse ou un code postal. |
| adresse introuvable, ou score < 0,5 | Adresse introuvable ou trop imprécise. Précisez la ville ou le code postal. |
| géocodeur en 429 | Le service d'adresses est très sollicité. Réessayez dans une seconde. |
| géocodeur injoignable | Le service d'adresses ne répond pas. Vérifiez le réseau puis réessayez. |

Les refus de l'API (§1) sont affichés tels quels.

**Géocodage** (`geocode`)

- Service : Géoplateforme de l'IGN, `https://data.geopf.fr/geocodage/search?q=…&limit=1`. Gratuit, sans clé.
- **Limite d'usage** : 50 requêtes par seconde et par adresse IP (en-tête `RateLimit-Limit: 50`). Au-delà : `429`.
- **Parade** :
  - un appel seulement à la soumission du formulaire, jamais à chaque touche ;
  - un cache en mémoire par saisie normalisée (espaces réduits, minuscules) : « 69002  Lyon » puis « 69002 LYON » ne font qu'un appel ;
  - un `429` donne un message clair et n'est pas mis en cache, pour que l'utilisateur puisse réessayer une seconde plus tard.
- `coordinates` est lu en `[lon, lat]` (GeoJSON) : c'est le piège de la bande dessinée, couvert par un test sur une adresse lyonnaise.
- Score minimal : 0,5. En dessous, « précisez la ville ».
- `nginx.conf` autorise `https://data.geopf.fr` dans `connect-src` et passe `Permissions-Policy` de `geolocation=()` à `geolocation=(self)`. Avant ce changement, la géolocalisation était bloquée sur le site servi par nginx.

## §3 · Côté API et MongoDB

**Distance** (`distance.js`)

- `haversineKm` : formule de haversine, `R = 6371` km, conversion en radians à l'entrée.
- `roundKm` : arrondi au dixième.
- `boundingBox` : demi-hauteur `r / 111,2` degrés (un degré de latitude vaut environ 111,2 km), demi-largeur divisée par `cos(lat)`. Les pôles et l'antiméridien ne sont pas gérés : les cinémas sont en France.

**Recherche par défaut : boîte puis cercle** (`findInBox`)

1. MongoDB filtre le rectangle avec l'index composé `{ latitude: 1, longitude: 1 }`.
2. Node mesure chaque cinéma de la boîte et écarte ceux des coins (`km <= radiusKm`).

Le cinéma de démonstration « Ciné Croix-Luizet » est placé exprès dans le coin de la boîte autour de Bellecour, à 6,3 km : la base le renvoie, le filtre l'écarte (test « le cinéma du coin de la boîte »).

**Défi, l'équivalent MongoDB de PostGIS** (`findWithGeoNear`, activé par `GEO_FINDER=geonear`)

- Champ `location` en GeoJSON `{ type: 'Point', coordinates: [lon, lat] }` et index `2dsphere`.
- Une seule étape d'agrégation : `$geoNear` avec `maxDistance` en mètres, `spherical: true`, et le filtre d'équipement dans `query`.
- Résultat : les mêmes 6 cinémas que la boîte autour de Bellecour, à moins de 0,5 % d'écart. MongoDB calcule sur une sphère de rayon 6 378,1 km au lieu de 6 371 km.
- Test : `MONGO_TEST_URI=mongodb://127.0.0.1:27017/geo_test?directConnection=true node --test test/geoNear.test.js`. Il est ignoré sans base, comme les tests Testcontainers du kit.

**Choix** : la boîte est le défaut, elle se lit facilement et suffit pour quelques centaines de cinémas. `$geoNear` devient intéressant si le volume grandit : tri et pagination pourraient alors se faire dans la base.

## §4 · Vie privée : où la position n'est pas gardée, et la preuve

| Endroit | Ce qui est fait | Preuve |
| --- | --- | --- |
| Navigateur → réseau | arrondi à 3 décimales avant l'envoi | `geo.test.ts` « Paramètres » ; position simulée 45.7576, 4.8317 envoyée en `lat=45.758&lon=4.832` |
| Front | en mémoire seulement : ni URL de page, ni `localStorage` | URL relevée après la recherche : `http://localhost:3001/cinemas` |
| Journal nginx | `log_format sans_position` (`$request_method $uri`, sans `$request`, `$request_uri` ni `$args`), au niveau du serveur | `geoPrivacy.test.js` ; ligne relevée : `172.20.0.1 [16/Nov/2026:14:00:53 +0000] "GET /api/cinemas" 400 170` |
| Journal de l'API | aucun `console` dans `src/geo/` ni dans `cinemaRoutes.js` ; `lat=abc` nomme le paramètre sans recopier la valeur | `geoPrivacy.test.js` ; `docker logs ynov-backend` : 0 ligne avec une coordonnée |
| Traces (Jaeger) | serveur : `lat` et `lon` masqués à la source (`redactedQueryParamsServer`), `url.query` supprimé par le collecteur ; navigateur : `url.full` coupé avant `?` ; MongoDB : valeurs remplacées par `?` | traces `cineslot-api` relevées via `/api/v3/traces` : 0 occurrence de `45.7576` ; `db.query.text` = `{"find":"?","filter":{"latitude":{"$gte":"?","$lte":"?"},…}}` |
| Base | aucune collection pour la position du spectateur ; seuls les cinémas ont une position | `Cinema.js` |
| Réponse | distance arrondie à 0,1 km, jamais la position reçue, `Cache-Control: no-store` | `cinemaRoutes.test.js` « la réponse ne contient ni la position reçue, ni de cache » |

Deux tiers reçoivent une information de lieu, et seulement à la demande de l'utilisateur :

- **L'IGN** reçoit l'adresse saisie, quand l'utilisateur choisit la saisie.
- **OpenStreetMap** reçoit les tuiles de la zone affichée, seulement si l'utilisateur clique « Afficher la carte ». La carte est masquée par défaut.

## §5 · Preuves

**Intégration** (pile Docker Compose, http://localhost:3001, position simulée par Playwright avec Chromium)

| Essai | Résultat observé |
| --- | --- |
| Autour de moi, Bellecour (45.7576, 4.8317) | « 6 cinéma(s) à moins de 5 km » : Ciné Bellecour 100 m, Le Grand Écran Terreaux 1,1 km, Les Écrans de la Croix-Rousse 1,8 km, Ciné Part-Dieu 2,1 km, Ciné Confluence 2,1 km, Studio Monplaisir 3,4 km. Carte : cercle de 5 km, 6 marqueurs, « © OpenStreetMap contributors » visible. Aucune erreur console. |
| Avec l'équipement IMAX | « 2 cinéma(s) à moins de 5 km » : Ciné Confluence, Ciné Part-Dieu. |
| Permission bloquée | « Localisation refusée. Saisissez une adresse ou un code postal. », focus sur le champ d'adresse. « 69002 » donne ensuite « Autour de : Lyon 2e Arrondissement », 6 cinémas. |
| `lat=95`, puis le journal de nginx | `400` `application/problem+json`, `detail` « Latitude invalide : entre -90 et 90 degrés. ». Journal : `"GET /api/cinemas" 400 170`, sans `?lat=95&lon=4.8`. |
| `lat=abc` | `400`, « Paramètre invalide : lat. » |

**Tests**

| Suite | Résultat |
| --- | --- |
| Back, `cd backend && npm test` | 32 tests : 31 verts, 0 rouge, 1 ignoré (`geoNear.test.js` sans base). Pour ce TP : 18 verts (`geoDistance` 6, `cinemaRoutes` 9 dont un qui enchaîne les 6 refus, `geoPrivacy` 3). |
| Back, défi `$geoNear` avec `MONGO_TEST_URI` | 1 vert |
| Front, `npx vitest run src/tests/geo.test.ts` | 15 verts : Position 5, Paramètres 2, Affichage 1, Géocodage 5, NearbyBar 2 avec audit axe |
| Front, `npm test` | 55 verts, 3 rouges. Les 3 rouges sont dans `ticketPdf.test.ts` (TP précédent) et échouent déjà sans ce TP. |
| Front, `npm run build` | passe |

Les valeurs de référence des tests ne sortent pas de notre code :

- Nashville → Los Angeles : 2 886,444 km, valeur publiée par Rosetta Code.
- Bellecour → République (Paris) : 392,549 km mesurés par PostGIS sur l'ellipsoïde, tolérance de 0,5 %.

## §6 · Ce que « à vol d'oiseau » ne promet pas

- **Ni un trajet, ni un temps.** 2,1 km à vol d'oiseau peuvent cacher le Rhône, un pont lointain ou 30 minutes de transports. L'interface écrit « à vol d'oiseau » sous chaque distance.
- **Ni une précision au mètre.**
  - La position envoyée est arrondie à environ 111 m.
  - La Terre est traitée comme une sphère (moins de 0,5 % d'écart, moins de 25 m sur 5 km).
  - La distance affichée est arrondie à 100 m.
  - Un cinéma à 4,98 km peut sortir ou entrer dans le rayon selon l'arrondi de la position.
- **Ni que la position du navigateur est juste.** Une position obtenue par IP ou Wi-Fi peut être fausse de plusieurs kilomètres. Au-delà de 1 km d'incertitude, la page affiche « Position approximative ».
- **Ni une adresse exacte pour un géocodage peu sûr.** Sous un score de 0,5, l'adresse est refusée plutôt que placée au mauvais endroit.
