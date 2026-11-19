import {optimize} from './engine.js';
self.onmessage=({data})=>{try{self.postMessage({ok:true,result:optimize(data)});}catch(error){self.postMessage({ok:false,error:error.message});}};
