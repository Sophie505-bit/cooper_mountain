import React,{memo,useEffect,useMemo,useRef,useState} from 'react';
import {AreaChart,Area,CartesianGrid,XAxis,YAxis} from 'recharts';
import {ChartContainer,ChartTooltip,ChartTooltipContent} from './components/ui/chart';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from './components/ui/card';
import {fmtTime} from './engine';

const colors=['#65edd0','#82b5ff','#ffc274'];

function OutputChart({epochs,products}){
  const host=useRef(null);
  const [visible,setVisible]=useState(false);
  const [period,setPeriod]=useState(0);
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){setVisible(true);observer.disconnect();}
    },{threshold:.08});
    observer.observe(host.current);
    return ()=>observer.disconnect();
  },[]);
  const config=useMemo(()=>Object.fromEntries(products.map((p,i)=>[p,{label:'Продукт '+p,color:colors[i]}])),[products]);
  const data=useMemo(()=>{
    const rows=[{minute:0,...Object.fromEntries(products.map(p=>[p,0]))},...epochs.map(e=>({minute:e.end,...Object.fromEntries(products.map(p=>[p,Math.round(e.final[p])]))}))];
    return rows.filter(r=>!period||(r.minute>=(period-1)*720&&r.minute<=period*720));
  },[period,epochs,products]);
  const start=period?(period-1)*720:0,end=period?period*720:2880;
  const ticks=Array.from({length:5},(_,i)=>start+i*(end-start)/4);
  return <section ref={host} className="production-report" aria-label="График выпуска">
    <Card className="production-card">
      <CardHeader className="production-heading"><div><CardTitle>Выпуск участка</CardTitle><CardDescription>Накопленный выпуск после упаковки</CardDescription></div>
        <div className="period-options" aria-label="Период графика">{[0,1,2,3,4].map(n=><button key={n} aria-pressed={period===n} onClick={()=>setPeriod(n)}>{n?'Смена '+n:'Все смены'}</button>)}</div>
      </CardHeader>
      <CardContent className="production-body">{visible&&<ChartContainer key={period} className="production-plot" config={config}>
        <AreaChart data={data} accessibilityLayer margin={{top:8,left:0,right:12,bottom:0}}>
          <defs>{colors.map((color,i)=><linearGradient key={color} id={'production-fill-'+i} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.47}/><stop offset="100%" stopColor={color} stopOpacity={.035}/></linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke="#303034"/>
          <XAxis type="number" dataKey="minute" domain={[start,end]} ticks={ticks} tickFormatter={fmtTime} tickLine={false} axisLine={false} tickMargin={9} minTickGap={18}/>
          <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={v=>(v/1e6).toLocaleString('ru-RU')+' млн'}/>
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_,rows)=>fmtTime(rows[0]?.payload.minute??0)}/>}/>
          {products.map((p,i)=><Area key={p} dataKey={p} type="linear" stackId="production" stroke={colors[i]} strokeWidth={1.6} fill={'url(#production-fill-'+i+')'} isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches} animationBegin={45*i} animationDuration={850} animationEasing="ease-out"/>)}
        </AreaChart>
      </ChartContainer>}</CardContent>
      <div className="production-legend">{products.map((p,i)=><span key={p}><i style={{background:colors[i]}}/>Продукт {p}</span>)}</div>
    </Card>
  </section>;
}
export default memo(OutputChart);
