# Livrable CONVOCATION.md — CinéSlot (Billet PDF de séance)

## 1 · Le contrat du téléchargement

- **Requête** : `GET /api/bookings/{id}/ticket.pdf` (option `?download=true` pour forcer le téléchargement au lieu de l'ouverture dans l'onglet).
  - L'URL ne contient que l'identifiant technique de la réservation (aucun nom de spectateur, ni titre de film, ni date).
- **Authentification** : cookie de session `HttpOnly`, `SameSite=Lax`, `path=/api` (`cineslot_session`), vérifié à chaque requête.
- **En-têtes de succès (`200 OK`)** :
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="ticket-<id>.pdf"` (ou `attachment; filename="ticket-<id>.pdf"` si `?download=true`)
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`
  - `Content-Length: <taille_en_octets>`
- **Messages d'erreur (`application/problem+json`, RFC 9457)** :
  - `401 Unauthorized` : « Votre session a expiré. Reconnectez-vous. »
  - `404 Not Found` : « Ce billet est introuvable. » (renvoyé aussi si le billet appartient à un autre spectateur, pour ne pas révéler son existence — protection anti-IDOR).
  - `409 Conflict` : « Cette réservation est annulée : son billet n'est plus disponible. »
  - `500 Internal Server Error` : « La génération du billet a échoué. Réessayez dans un instant. » (ou le `detail` du `ProblemDetail`).

---

## 2 · Où le PDF est fabriqué, et pourquoi

Le billet PDF est fabriqué **côté serveur** (Express + `pdfkit` + polices embarquées `DejaVu Sans`) parce que c'est un **document officiel qui fait foi** au contrôle d'accès en salle : son rendu, son horaire et sa référence doivent être garantis identiques quel que soit le navigateur ou le poste du spectateur, sans exposer de logique métier ni de données d'autres utilisateurs côté client. Le `@media print` côté navigateur reste réservé à l'impression locale de confort.

---

## 3 · Le bug du fuseau horaire (`Europe/Paris`)

Les créneaux `startsAt` sont stockés en base MongoDB au format ISO 8601 UTC (`...Z`), et le conteneur Node.js tourne en UTC : sans conversion explicite, un rendez-vous/séance réservé pour `9 h 30` en France était imprimé `8 h 30` en hiver (UTC+1) ou `7 h 30` en été (UTC+2). Le formateur serveur (`backend/src/utils/ticketFormatters.js`) et les vues front (`ReservationsView.vue`, `ReservationModal.vue`, `SlotCard.vue`) imposent désormais explicitement `timeZone: 'Europe/Paris'`, garantissant `9 h 30` été comme hiver.

---

## 4 · Intégration et preuves (`curl -D -`)

Preuves relevées sur la pile Docker Compose complète (`http://localhost:3001/api`, derrière Nginx) pour la réservation `ce139aff-9a37-450e-97ab-fa6588ee271e` :

### 1. Succès (`200 OK` inline & attachment)

```http
HTTP/1.1 200 OK
Server: nginx/1.31.8
Content-Type: application/pdf
Content-Length: 28051
Content-Disposition: inline; filename="ticket-ce139aff-9a3.pdf"
Cache-Control: no-store
X-Content-Type-Options: nosniff
X-Trace-Id: a48457268fa5b0efa186f51543a680db
```

Avec `?download=true` :

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="ticket-ce139aff-9a3.pdf"
Cache-Control: no-store
X-Trace-Id: 35ea641263a221d478d92a5db2306b52
```

### 2. Protection anti-IDOR — second spectateur (`404 Not Found`)

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json; charset=utf-8
X-Trace-Id: 9b71c1ef53837460ae1172cd054535f1

{"type":"about:blank","title":"Not Found","status":404,"detail":"Ce billet est introuvable.","message":"Ce billet est introuvable."}
```

### 3. Billet annulé (`409 Conflict`)

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json; charset=utf-8
X-Trace-Id: a2cb015c80fa2ecb5c31c6fc3ae0dfcc

{"type":"about:blank","title":"Conflict","status":409,"detail":"Cette réservation est annulée : son billet n'est plus disponible.","message":"Cette réservation est annulée : son billet n'est plus disponible."}
```

### 4. Requête sans session (`401 Unauthorized`)

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json; charset=utf-8
X-Trace-Id: b29fffc1a35cde7ed1c96f807fb4b21a

{"type":"about:blank","title":"Unauthorized","status":401,"detail":"Votre session a expiré. Reconnectez-vous.","message":"Votre session a expiré. Reconnectez-vous."}
```

---

## 5 · Défi : le contrat asynchrone d'un document long (récapitulatif annuel)

Pour un **récapitulatif annuel** regroupant une centaine de séances (génération lente pouvant dépasser le `proxy_read_timeout` de Nginx et bloquer les workers Node), on remplace le `GET` synchrone par un contrat asynchrone en trois appels :

1. **Commander (`POST /api/me/annual-summaries`)** :
   - En-têtes requête : cookie `cineslot_session` + jeton CSRF (`X-CSRF-TOKEN`, obligatoire car le `POST` crée une ressource/tâche en base).
   - Réponse : `202 Accepted` avec en-tête `Location: /api/me/annual-summaries/{jobId}` et corps `{ "jobId": "...", "status": "PENDING" }`.
2. **Suivre (`GET /api/me/annual-summaries/{jobId}`)** :
   - Protégé par session + vérification `job.ownerId === req.sessionUser.id` (`404` sinon).
   - Réponse `200 OK` (`Cache-Control: no-store`) : `{ "status": "PENDING" | "RUNNING" | "DONE" | "FAILED" }`.
   - **Côté front** : interrogation bornée toutes les `2000 ms` avec un maximum de `60` tentatives (2 minutes max) — ou notification poussée via le flux **SSE** déjà présent dans CinéSlot — puis arrêt propre avec message utilisateur si le délai est dépassé ou si `status === 'FAILED'`.
3. **Télécharger (`GET /api/me/annual-summaries/{jobId}/file`)** :
   - Mêmes droits (`401`, `404` anti-IDOR) et mêmes en-têtes que le billet unitaire (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="summary-{jobId}.pdf"`, `Cache-Control: no-store`), ou `409 Conflict` si la tâche n'est pas encore `DONE`.
   - **Durée de vie / purge** : le fichier généré expire automatiquement (ex. TTL de `24 h` côté stockage + tâche de purge périodique) pour éviter de saturer le disque du serveur.
