import { startTracing } from './tracing';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Start OpenTelemetry before creating the Vue application
startTracing();

// Import Tailwind CSS
import './style.css';

const app = createApp(App);

// Install Pinia (state management)
app.use(createPinia());

// Install Vue Router
app.use(router);

// Mount the app
app.mount('#app');
