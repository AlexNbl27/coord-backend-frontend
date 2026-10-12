const { createApp, ref, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    const slots = ref([]);
    const connection = ref('Connexion au cinéma…');
    const message = ref('');
    const pending = ref(null);
    const customerId = `spectateur-${crypto.randomUUID()}`;
    let stream, timer;
    let running = false, dirty = false, stopped = false;

    async function reload() {
      if (stopped) return;
      dirty = true;
      if (running) return;
      running = true;
      try {
        while (dirty && !stopped) {
          dirty = false;
          const r = await fetch('/api/slots');
          if (!r.ok) throw new Error('Lecture impossible');
          const data = await r.json();
          if (!stopped) slots.value = data;
        }
      } catch (e) { 
        message.value = 'Actualisation des séances impossible. Nouvelle tentative automatique.'; 
      }
      finally { 
        running = false; 
      }
    }

    async function reserve(slot) {
      pending.value = slot.id;
      try {
        const r = await fetch(`/api/slots/${slot.id}/reservations`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId })
        });
        if (r.status === 201) {
          message.value = `🎟️ Votre place pour « ${slot.movieTitle || 'la séance'} » est confirmée ! Bon film.`;
        } else if (r.status === 409) {
          message.value = `❌ Cette séance vient d'être réservée par un autre spectateur.`;
        } else {
          message.value = `Réservation refusée : code HTTP ${r.status}.`;
        }
      } catch (e) {
        message.value = 'Réponse perdue : réservation non confirmée. Vérifiez avant de réessayer.';
      } finally { 
        pending.value = null; 
        await reload(); 
      }
    }

    async function createSlot() {
      try {
        const r = await fetch('/api/lab/slots', { method: 'POST' });
        if (!r.ok) throw new Error();
        message.value = '🎬 Nouvelle séance de cinéma ajoutée à la programmation !';
        await reload();
      } catch (e) { 
        message.value = 'Création impossible : vérifiez le profil lab.'; 
      }
    }

    onMounted(() => {
      // 1. Initialisation unique du flux SSE
      if (!stream) {
        stream = new EventSource('/api/slots/events');

        // 2. Événement 'ready' : connexion établie et relecture
        stream.addEventListener('ready', () => {
          connection.value = 'Connecté (SSE direct)';
          reload();
        });

        // 3. Événement 'slot-updated' : actualisation immédiate sans rechargement
        stream.addEventListener('slot-updated', () => {
          reload();
        });

        // 4. Gestion d'erreur sans close() pour permettre la reconnexion automatique du navigateur
        stream.onerror = () => {
          connection.value = 'Connexion interrompue…';
        };
      }

      // 6. Filet de sécurité : polling périodique de secours toutes les 30s
      timer = setInterval(() => {
        reload();
      }, 30000);

      // Relecture initiale
      reload();
    });

    onUnmounted(() => {
      // 5. Nettoyage propre au démontage du composant
      stopped = true;
      if (stream) {
        stream.close();
        stream = null;
      }
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });

    return { slots, connection, message, pending, reserve, createSlot };
  }
}).mount('#app');
