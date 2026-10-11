import React,{useEffect,useState} from 'react';
import {AbsoluteFill,Composition,Img,OffthreadVideo,Sequence,continueRender,delayRender,cancelRender,interpolate,registerRoot,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {ProjectProfile,VideoScript} from '../domain.js';

type Props={script:VideoScript;profile:ProjectProfile;assets:Record<string,string>;logo:string|null};
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
function Fonts(){
  const [handle]=useState(()=>delayRender('Loading local brand typography'));
  useEffect(()=>{let active=true;Promise.all([['Newsreader','newsreader.woff2'],['Newsreader Italic','newsreader-italic.woff2'],['Instrument Sans','instrument.woff2'],['IBM Plex Mono','plex-mono.woff2']].map(async([family,name])=>{const font=new FontFace(family!,'url('+staticFile('fonts/'+name)+')',{weight:family?.includes('Plex')?'400':'100 900'});await font.load();document.fonts.add(font);})).then(()=>{if(active)continueRender(handle);}).catch(cancelRender);return()=>{active=false;};},[handle]);
  return null;
}
function Fingerprint({color,size=72,draw=1}:{color:string;size?:number;draw?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"><g strokeDasharray="80" strokeDashoffset={80*(1-draw)}><path d="M6.2 18.4C4.8 16.9 4 14.9 4 12.6 4 8 7.6 4.4 12 4.4c3.4 0 6.3 2.1 7.4 5.1"/><path d="M8.3 19.4c-1.2-1.6-1.9-3.5-1.9-5.6 0-3.3 2.5-5.9 5.6-5.9 2.6 0 4.8 1.8 5.4 4.3"/><path d="M11 20c-.7-1.4-1.1-3-1.1-4.7 0-1.7 1-3.1 2.4-3.1 1.3 0 2.3 1.2 2.3 2.9 0 1.9.6 3.7 1.6 5.1"/><path d="M19.8 13.4c.1 2.1-.4 4.1-1.4 5.8"/></g></svg>;
}
function Brand({profile,logo,inverse=false}:Pick<Props,'profile'|'logo'>&{inverse?:boolean}){
  if(logo)return <Img src={staticFile(logo)} style={{width:340,height:82,objectFit:'contain',objectPosition:'left'}}/>;
  return <div style={{display:'flex',gap:22,alignItems:'center',fontFamily:profile.typography.display,fontSize:52,color:inverse?profile.colors.background:profile.colors.ink}}>{profile.id==='whodunnit'&&<Fingerprint color={inverse?'#d27a5f':profile.colors.accent} size={64}/>}<span>{profile.logo.value}</span></div>;
}
function Words({text,frame,size,family,color}:{text:string;frame:number;size:number;family:string;color:string}){
  return <div style={{fontFamily:family,fontSize:size,lineHeight:1.12,letterSpacing:-1.5,color}}>{text.split(' ').map((word,i)=><span key={i} style={{display:'inline-block',marginRight:size*0.23,opacity:interpolate(frame,[i*3,i*3+14],[0,1],clamp),transform:'translateY('+interpolate(frame,[i*3,i*3+14],[20,0],clamp)+'px)'}}>{word}</span>)}</div>;
}
function WritingScene({scene,index,profile,script,logo}:Props&{scene:VideoScript['scenes'][number];index:number}){
  const f=useCurrentFrame(),{fps}=useVideoConfig();const content=profile.approvedContent.find((c)=>c.id===script.contentId)!;const closing=scene.kind==='cta';
  const closeAccent=profile.id==='whodunnit'?'#d27a5f':profile.colors.accent;const ink=closing?profile.colors.background:profile.colors.ink;const paper=closing?profile.colors.ink:profile.colors.background;
  const reveal=spring({frame:f,fps,config:{damping:200}});
  const text=scene.kind==='cta'?content.title:scene.kind==='hook'?scene.headline:scene.body;
  return <AbsoluteFill style={{background:paper,color:ink,padding:'160px 96px 240px',fontFamily:profile.typography.body}}>
    <Brand profile={profile} logo={logo} inverse={closing}/>
    <div style={{position:'absolute',left:96,top:335,fontFamily:profile.typography.mono,fontSize:30,letterSpacing:4,color:closing?profile.colors.background:profile.colors.muted}}>{['A NOTE ON WRITING','01 / ORIGINAL','02 / EDITED','YOUR NEXT DRAFT'][index]}</div>
    {closing?<div style={{position:'absolute',top:540,left:96,right:96}}>
      <Fingerprint color={closeAccent} size={170} draw={interpolate(f,[0,45],[0,1],clamp)}/>
      <div style={{marginTop:80}}><Words text={text} frame={f-12} size={112} family={profile.typography.display} color={ink}/></div>
      <div style={{fontSize:46,marginTop:88,lineHeight:1.4,opacity:interpolate(f,[35,55],[0,1],clamp)}}>{profile.cta}<span style={{display:'inline-block',marginLeft:25,color:profile.colors.accent}}>↗</span></div>
    </div>:scene.kind==='after'?<div style={{position:'absolute',left:96,right:96,top:435}}>
      <div style={{fontFamily:profile.typography.display,fontSize:52,lineHeight:1.2,color:profile.colors.muted,opacity:interpolate(f,[0,25],[0.9,0.85],clamp),transform:'translateY('+interpolate(f,[0,25],[100,0],clamp)+'px)',textDecoration:f>18?'line-through':'none',textDecorationColor:profile.colors.accent,textDecorationThickness:2}}>{content.before}</div>
      <div style={{marginTop:105}}><Words text={content.after!} frame={f-18} size={108} family={profile.typography.display} color={profile.colors.accent}/></div>
      <div style={{marginTop:75,paddingTop:32,borderTop:'1px solid '+profile.colors.muted,fontSize:44,opacity:interpolate(f,[65,82],[0,1],clamp)}}>{content.body}</div>
    </div>:<div style={{position:'absolute',left:96,right:96,top:535,transform:'translateY('+((1-reveal)*36)+'px)'}}>
      {scene.kind==='before'?<div style={{fontSize:86,lineHeight:1.23,fontFamily:profile.typography.display,letterSpacing:-1.3}}>
        {text.split(' ').map((w,i)=><span key={i} style={{opacity:interpolate(f,[i*2,i*2+10],[0,1],clamp)}}>{w+' '}</span>)}
        <div style={{height:4,background:profile.colors.accent,width:interpolate(f,[38,80],[0,100],clamp)+'%',marginTop:42}}/>
      </div>:<Words text={text} frame={f} size={112} family={profile.typography.display} color={ink}/>}
      <div style={{marginTop:95,paddingTop:36,borderTop:'1px solid '+profile.colors.muted,fontSize:42,lineHeight:1.4,opacity:interpolate(f,[55,75],[0,1],clamp)}}>
        {scene.kind==='before'?content.disclaimer:scene.body!==scene.headline?scene.body:content.title}
      </div>
    </div>}
    <div style={{position:'absolute',bottom:250,left:96,right:96,display:'flex',justifyContent:'space-between',fontFamily:profile.typography.mono,fontSize:32,color:ink,opacity:0.85}}><span>{content.disclaimer??'PROJECT NOTE'}</span><span>{String(index+1).padStart(2,'0')} / 04</span></div>
  </AbsoluteFill>;
}
function ExplainerScene({scene,index,profile,script,logo}:Props&{scene:VideoScript['scenes'][number];index:number}){
  const f=useCurrentFrame();const content=profile.approvedContent.find((c)=>c.id===script.contentId)!;const closing=scene.kind==='cta';
  return <AbsoluteFill style={{background:profile.colors.background,color:profile.colors.ink,padding:'150px 90px 230px',fontFamily:profile.typography.body}}>
    <Brand profile={profile} logo={logo}/>
    <div style={{marginTop:125,fontFamily:profile.typography.mono,fontSize:25,color:profile.colors.accent,letterSpacing:3}}>{closing?profile.name.toUpperCase()+' / PROJECT NOTE':index===0?'A RECORDKEEPING NOTE':'0'+index+' / BUILD THE HABIT'}</div>
    <div style={{marginTop:55}}><Words text={closing?profile.cta:scene.headline} frame={f} size={84} family={profile.typography.display} color={profile.colors.ink}/></div>
    {scene.kind==='lesson'&&profile.id==='gigwise'?<div style={{marginTop:85}}>
      {index===1?<div>{['DATE','BUSINESS PURPOSE','SUPPORTING RECORD'].map((label,i)=><div key={label} style={{display:'flex',alignItems:'baseline',gap:36,padding:'37px 0',borderTop:'1px solid '+profile.colors.muted,opacity:interpolate(f,[20+i*9,35+i*9],[0,1],clamp),transform:'translateX('+interpolate(f,[20+i*9,35+i*9],[40,0],clamp)+'px)'}}><span style={{color:profile.colors.accent,fontFamily:profile.typography.mono,fontSize:29}}>0{i+1}</span><span style={{fontSize:45,letterSpacing:1}}>{label}</span></div>)}</div>:<div style={{borderTop:'1px solid '+profile.colors.muted,paddingTop:55,opacity:interpolate(f,[18,40],[0,1],clamp)}}>
        <div style={{fontSize:58,color:profile.colors.accent}}>RECEIPT</div>
        <svg width="80" height="110" viewBox="0 0 80 110" aria-hidden="true" style={{margin:'20px 0',overflow:'visible'}}><path d="M20 0v85m-12-14 12 14 12-14" fill="none" stroke={profile.colors.accent} strokeWidth="3" strokeDasharray="150" strokeDashoffset={150*(1-interpolate(f,[30,70],[0,1],clamp))}/></svg>
        <div style={{fontSize:58}}>MATCHING EXPENSE</div>
      </div>}
      <div style={{marginTop:55,fontSize:40,lineHeight:1.5,color:profile.colors.muted}}>{scene.body!==scene.headline?scene.body:content.body}</div>
    </div>:<div style={{marginTop:95,fontSize:38,lineHeight:1.45,color:profile.colors.accent,opacity:interpolate(f,[35,55],[0,1],clamp)}}>{closing?content.title:scene.body!==scene.headline?scene.body:content.body}</div>}
    <div style={{position:'absolute',left:90,right:90,bottom:250,fontFamily:profile.typography.mono,fontSize:31,lineHeight:1.5,color:profile.colors.muted}}>{content.disclaimer}</div>
  </AbsoluteFill>;
}
function VisualScene({scene,index,profile,assets,logo,script}:Props&{scene:VideoScript['scenes'][number];index:number}){
  const f=useCurrentFrame();const source=scene.assetId?assets[scene.assetId]:undefined;
  if(!source||index===0||index===3)return <ExplainerScene {...{scene,index,profile,assets,logo,script}}/>;
  const reveal=interpolate(f,[0,20],[0,1],clamp);
  return <AbsoluteFill style={{background:profile.colors.background,color:profile.colors.ink,fontFamily:profile.typography.body}}>
    <div style={{position:'absolute',left:80,right:80,top:140,zIndex:2}}><Brand profile={profile} logo={logo}/><h1 style={{fontSize:64,lineHeight:1.15,marginTop:60}}>{scene.headline}</h1></div>
    <div style={{position:'absolute',left:0,right:0,top:510,height:950,overflow:'hidden',clipPath:'inset('+((1-reveal)*100)+'% 0 0 0)'}}>
      {script.template==='gameplay'?<OffthreadVideo muted src={staticFile(source)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Img src={staticFile(source)} style={{width:'100%',height:'100%',objectFit:'contain',transform:'scale('+interpolate(f,[0,scene.seconds*30],[1,1.05],clamp)+')'}}/>}
    </div>
    <div style={{position:'absolute',left:80,right:80,bottom:250,fontSize:36,lineHeight:1.4}}>{scene.body}</div>
  </AbsoluteFill>;
}
function Video(props:Props){
  const f=useCurrentFrame();const duration=props.script.scenes.reduce((n,s)=>n+s.seconds*30,0);let offset=0;
  return <AbsoluteFill style={{background:props.profile.colors.background}}>
    <Fonts/>
    {props.script.scenes.map((scene,index)=>{const from=offset;offset+=scene.seconds*30;return <Sequence key={index} from={from} durationInFrames={scene.seconds*30}>
      {props.script.template==='before-after'||(props.script.template==='announcement'&&props.profile.id==='whodunnit')?<WritingScene {...props} scene={scene} index={index}/>:['gameplay','feature-demo'].includes(props.script.template)?<VisualScene {...props} scene={scene} index={index}/>:<ExplainerScene {...props} scene={scene} index={index}/>}
    </Sequence>;})}
    <div style={{position:'absolute',bottom:150,left:90,right:90,height:3,background:props.profile.colors.muted,opacity:0.65}}><div style={{height:3,width:(f/(duration-1)*100)+'%',background:props.profile.colors.accent}}/></div>
  </AbsoluteFill>;
}
const defaultProps={} as Props;
function Root(){return <>{['BeforeAfter','Explainer','FeatureDemo','Gameplay','Announcement'].map((id)=><Composition key={id} id={id} component={Video} width={1080} height={1920} fps={30} durationInFrames={600} defaultProps={defaultProps} calculateMetadata={({props})=>({durationInFrames:props.script.scenes.reduce((n,s)=>n+s.seconds*30,0)})}/>)}</>;}
registerRoot(Root);
