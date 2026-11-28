import {evaluateProposals} from './aiPlanning.js';
self.onmessage=({data})=>{try{self.postMessage({ok:true,result:evaluateProposals(data.config,data.proposals)});}catch(e){self.postMessage({ok:false,error:e.message});}};
