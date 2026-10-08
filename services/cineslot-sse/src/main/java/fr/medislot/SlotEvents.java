package fr.medislot;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SlotEvents {

  // Collection thread-safe pour gérer les abonnés concurrents
  private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

  public SseEmitter subscribe() {
    // Timeout de 3 minutes (180 000 ms)
    SseEmitter emitter = new SseEmitter(180_000L);
    this.emitters.add(emitter);

    // Nettoyage automatique sur fin, timeout ou erreur
    Runnable cleanup = () -> this.emitters.remove(emitter);
    emitter.onCompletion(cleanup);
    emitter.onTimeout(cleanup);
    emitter.onError(e -> cleanup.run());

    // Envoi du signal initial obligatoire : event: ready / data: {"action":"reload"}
    try {
      emitter.send(SseEmitter.event()
        .name("ready")
        .data(Map.of("action", "reload")));
    } catch (IOException e) {
      cleanup.run();
    }

    return emitter;
  }

  public void changed(Slot slot) {
    // Règle de confidentialité : uniquement slotId, status et version (aucun bookedBy ni bookingId)
    Map<String, Object> payload = Map.of(
      "slotId", slot.id,
      "status", slot.status,
      "version", slot.version
    );

    // Diffusion à tous les abonnés actifs avec isolation des erreurs
    for (SseEmitter emitter : emitters) {
      try {
        emitter.send(SseEmitter.event()
          .name("slot-updated")
          .data(payload));
      } catch (Exception e) {
        emitters.remove(emitter);
      }
    }
  }

  // Heartbeat périodique toutes les 15 secondes pour maintenir la connexion active
  @Scheduled(fixedRate = 15000)
  public void keepAlive() {
    for (SseEmitter emitter : emitters) {
      try {
        emitter.send(SseEmitter.event().comment("keepalive"));
      } catch (Exception e) {
        emitters.remove(emitter);
      }
    }
  }
}
