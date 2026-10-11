import React from 'react';
import {interpolate} from 'remotion';
import type {ProjectProfile,VideoScript} from '../domain.js';

// Pure frame view: the dashboard/test preview can inspect a frame without
// starting inference, rendering a video, or approving a production job.
export function CreativeSceneFrame({scene,frame,profile,disclaimer,brand}:{scene:VideoScript['scenes'][number];frame:number;profile:ProjectProfile;disclaimer:string;brand?:React.ReactNode}){
 const lines=scene.displayTexts??[scene.headline,scene.body],layout=scene.layout??'focus',progress=scene.transition==='cut'?1:interpolate(frame,[0,20],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),accent=profile.colors.accent;
 const copyStyle={fontFamily:profile.typography.body,fontSize:46,lineHeight:1.35};
 const nodes=lines.map((text,i)=><div key={i} style={{...copyStyle,padding:'34px 28px',borderTop:'3px solid '+accent,color:i===0?profile.colors.ink:accent,opacity:scene.transition==='cut'?1:interpolate(frame,[i*7,15+i*7],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{text}</div>);
 return <div data-layout={layout} style={{position:'absolute',inset:0,background:profile.colors.background,color:profile.colors.ink,padding:'150px 80px 240px',boxSizing:'border-box'}}>
  {brand??<div style={{fontFamily:profile.typography.display,fontSize:52}}>{profile.logo.value}</div>}
  <div style={{marginTop:40,height:2,background:profile.colors.muted}}/>
  {!lines.includes(scene.headline)&&<div style={{fontFamily:profile.typography.display,fontSize:64,lineHeight:1.18,marginTop:60}}>{scene.headline}</div>}
  <div style={{marginTop:100,opacity:progress,transform:scene.transition==='slide'?'translateX('+((1-progress)*50)+'px)':'none'}}>
   {layout==='comparison'?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,alignItems:'start'}}>{nodes}</div>:
    layout==='sequence'?<div>{nodes.map((node,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:18,marginTop:i?35:0}}><div style={{fontFamily:profile.typography.mono,fontSize:34,color:accent,paddingTop:34}}>{String(i+1).padStart(2,'0')}</div>{node}</div>)}</div>:
    layout==='relationship'?<div>{nodes.map((node,i)=><React.Fragment key={i}>{i>0&&<div style={{height:62,borderLeft:'3px solid '+accent,marginLeft:45,width:1}}/>}{node}</React.Fragment>)}</div>:
    <div>{lines.map((text,i)=><div key={i} style={{fontFamily:i===0?profile.typography.display:profile.typography.body,fontSize:i===0?88:44,lineHeight:1.22,marginTop:i?75:0,color:i===0?profile.colors.ink:accent}}>{text}</div>)}</div>}
  </div>
  {!lines.includes(scene.body)&&scene.body!==scene.headline&&<div style={{...copyStyle,marginTop:55,color:profile.colors.muted}}>{scene.body}</div>}
  <div style={{position:'absolute',left:80,right:80,bottom:250,fontFamily:profile.typography.mono,fontSize:29,lineHeight:1.45,color:profile.colors.muted}}>{scene.disclaimer??disclaimer}</div>
 </div>;
}
