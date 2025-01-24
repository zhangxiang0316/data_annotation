import {createApp} from 'vue'
import App from './App.vue'
import '@/assets/styles/index.css'
import router from './router/index.js'
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import directive from "./directives"; // directive

const app = createApp(App)
directive(app);
app.use(router).use(ArcoVue).mount('#app')
