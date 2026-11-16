<template>
  <div
    ref="el"
    role="region"
    aria-label="Carte des cinémas"
    class="h-80 w-full rounded-2xl border border-cinema-border/50 overflow-hidden"
  ></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Center } from '../services/geo';

interface MapCinema {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
}

const props = defineProps<{
  center: Center;
  radiusKm: number;
  cinemas: MapCinema[];
}>();

const el = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

const draw = () => {
  if (!map || !layer) return;
  layer.clearLayers();
  const center = L.latLng(props.center.lat, props.center.lon);
  L.circle(center, {
    radius: props.radiusKm * 1000,
    color: '#c8a456',
    weight: 2,
    fillOpacity: 0.12,
  }).addTo(layer);
  for (const c of props.cinemas) {
    L.circleMarker([c.latitude, c.longitude], { radius: 7, color: '#c8a456', fillOpacity: 0.9 })
      .bindTooltip(c.name)
      .addTo(layer);
  }
  map.fitBounds(center.toBounds(props.radiusKm * 2000));
};

onMounted(() => {
  if (!el.value) return;
  map = L.map(el.value, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  draw();
});

watch(() => [props.center, props.radiusKm, props.cinemas], draw);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>
