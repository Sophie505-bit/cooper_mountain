import tailwind from '@tailwindcss/vite';
import {defineConfig} from 'vite';
export default defineConfig({plugins:[tailwind()],server:{proxy:{'/api/ai':'http://127.0.0.1:8787'}},build:{rollupOptions:{output:{manualChunks:{'three':['three'],'react':['react','react-dom']}}}}});
