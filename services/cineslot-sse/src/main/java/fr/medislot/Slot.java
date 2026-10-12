package fr.medislot;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("slots")
public class Slot {
  @Id public String id;
  public String startsAt;
  public String status = "AVAILABLE";
  public long version;
  public String bookingId;
  public String bookedBy;
  public int claimCount;

  // Champs dédiés au thème cinéma (CinéSlot)
  public String movieTitle = "Interstellar";
  public String hall = "Salle 1 - IMAX Laser";

  public Slot() {}

  public Slot(String id, String startsAt) {
    this.id = id;
    this.startsAt = startsAt;
  }

  public Slot(String id, String startsAt, String movieTitle, String hall) {
    this.id = id;
    this.startsAt = startsAt;
    this.movieTitle = movieTitle;
    this.hall = hall;
  }
}
