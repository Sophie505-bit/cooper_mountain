import tailwind from '@tailwindcss/vite';
import {defineConfig} from 'vite';
export default defineConfig({plugins:[tailwind()],build:{rollupOptions:{output:{manualChunks:{'three':['three'],'react':['react','react-dom']}}}}});
