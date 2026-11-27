import React from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './ui/select';
import {Slider} from './ui/slider';
export function Choice({children,value,onChange,disabled,...props}){
 return <Select value={String(value)} disabled={disabled} onValueChange={value=>onChange({target:{value}})}><SelectTrigger {...props}><SelectValue/></SelectTrigger><SelectContent position="popper" style={{zIndex:500}}>{React.Children.toArray(children).map(o=>{const v=String(o.props.value??o.props.children);return <SelectItem key={v} value={v} disabled={o.props.disabled}>{o.props.children}</SelectItem>})}</SelectContent></Select>;
}
export function Range({value,onChange,min,max,step,type,...props}){
 return <Slider {...props} value={[+value]} min={+min} max={+max} step={+step} onValueChange={([v])=>onChange({target:{value:v}})}/>;
}
