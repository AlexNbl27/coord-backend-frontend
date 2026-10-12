package fr.medislot;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Profile("lab")
@RestController
@RequestMapping("/api/lab")
public class LabController {
  private final MongoTemplate mongo;
  private final SlotEvents events;

  // Catalogue de séances de cinéma pour les créneaux de démonstration
  private static final List<String[]> MOVIES_CATALOG = List.of(
    new String[]{"Interstellar", "Salle 1 · IMAX Laser"},
    new String[]{"Inception", "Salle 2 · Dolby Atmos"},
    new String[]{"Dune : Deuxième Partie", "Salle 1 · IMAX Laser"},
    new String[]{"Oppenheimer", "Salle 3 · 70mm Grand Large"},
    new String[]{"Blade Runner 2049", "Salle 4 · 4DX Immersion"},
    new String[]{"The Matrix", "Salle 5 · Rétro Culte"}
  );
  private static final Random RNG = new Random();

  public LabController(MongoTemplate mongo, SlotEvents events) {
    this.mongo = mongo; 
    this.events = events;
  }

  @PostMapping("/slots")
  @ResponseStatus(HttpStatus.CREATED)
  public SlotController.SlotView create() {
    String[] selectedMovie = MOVIES_CATALOG.get(RNG.nextInt(MOVIES_CATALOG.size()));
    Slot slot = mongo.insert(new Slot(
      UUID.randomUUID().toString(),
      Instant.now().plusSeconds(86400).toString(),
      selectedMovie[0],
      selectedMovie[1]
    ));
    events.changed(slot);
    return SlotController.SlotView.from(slot);
  }

  @GetMapping("/slots/{id}/proof")
  public Map<String, Object> proof(@PathVariable String id) {
    Slot s = mongo.findById(id, Slot.class);
    if (s == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return Map.of(
      "id", s.id, 
      "status", s.status, 
      "claimCount", s.claimCount,
      "version", s.version, 
      "bookingId", s.bookingId == null ? "" : s.bookingId
    );
  }
}
