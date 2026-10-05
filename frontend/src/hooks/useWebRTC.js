import { useCallback, useEffect, useRef, useState } from 'react';

const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const isScreenTrack=(entry,track)=>Boolean(track&&(track.id===entry.screenTrackId||(entry.screenMid!=null&&entry.trackMids.get(track.id)===entry.screenMid)));
const tracePeer=(entry,phase,details={})=>{
  if(!import.meta.env.DEV)return;
  console.debug(`[WebRTC] local=${entry.localSocketId} remote=${entry.remoteSocketId} ${phase}`,{connectionState:entry.pc.connectionState,iceConnectionState:entry.pc.iceConnectionState,signalingState:entry.pc.signalingState,...details});
};
const traceSignal=(localSocketId,remoteSocketId,phase,details={})=>{
  if(!import.meta.env.DEV)return;
  console.debug(`[WebRTC] local=${localSocketId} remote=${remoteSocketId} ${phase}`,details);
};

export default function useWebRTC(socket,stream,meetingCode,participantsList,onFailure=()=>{}){
  const peers=useRef(new Map());
  const streamRef=useRef(stream);
  const screenStreamRef=useRef(null);
  const knownScreenShares=useRef(new Map());
  const pendingCandidates=useRef(new Map());
  const failureRef=useRef(onFailure);
  const [remoteStreams,setRemoteStreams]=useState({});
  const [remoteScreenStreams,setRemoteScreenStreams]=useState({});
  streamRef.current=stream;
  failureRef.current=onFailure;

  const publish=useCallback(()=>{
    const cameras={};
    const screens={};
    for(const [id,entry] of peers.current){
      for(const track of entry.fallbackStream.getTracks())if(isScreenTrack(entry,track)){
        entry.screenFallbackStream||=new MediaStream();
        if(!entry.screenFallbackStream.getTracks().some((item)=>item.id===track.id))entry.screenFallbackStream.addTrack(track);
        entry.fallbackStream.removeTrack(track);
        entry.streams.set(entry.screenFallbackStream.id,entry.screenFallbackStream);
      }
      for(const [streamId,remoteStream] of entry.streams){
        const screen=entry.screenStreamId===streamId||remoteStream.getTracks().some(track=>isScreenTrack(entry,track));
        if(screen){if(entry.screenShareActive)screens[id]=remoteStream}
        else if(!cameras[id])cameras[id]=remoteStream;
      }
      if(entry.fallbackStream.getTracks().length&&!cameras[id])cameras[id]=entry.fallbackStream;
    }
    setRemoteStreams(cameras);
    setRemoteScreenStreams(screens);
  },[]);

  const closePeer=useCallback((id)=>{
    const entry=peers.current.get(id);
    if(!entry)return;
    tracePeer(entry,'peer closed');
    entry.pc.onicecandidate=null;
    entry.pc.ontrack=null;
    entry.pc.onnegotiationneeded=null;
    entry.pc.onsignalingstatechange=null;
    entry.pc.onconnectionstatechange=null;
    entry.pc.oniceconnectionstatechange=null;
    if(entry.recoveryTimer)clearTimeout(entry.recoveryTimer);
    entry.pc.close();
    peers.current.delete(id);
    pendingCandidates.current.delete(id);
    publish();
  },[publish]);

  const getPeer=useCallback((id,user,forceOffer=false)=>{
    if(!id||!socket.id)return null;
    let entry=peers.current.get(id);
    if(entry?.pc.signalingState==='closed'){closePeer(id);entry=null}
    if(entry){if(user)entry.user=user;tracePeer(entry,'peer reused');return entry}

    const pc=new RTCPeerConnection(RTC_CONFIG);
    const knownScreen=knownScreenShares.current.get(id);
    const polite=socket.id.localeCompare(id)>0;
    entry={pc,user:user||{},localSocketId:socket.id,remoteSocketId:id,streams:new Map(),fallbackStream:new MediaStream(),screenStreamId:knownScreen?.streamId||null,screenTrackId:knownScreen?.trackId||null,screenMid:null,screenShareActive:Boolean(knownScreen),screenFallbackStream:null,screenSender:null,screenTransceiver:null,cameraSenders:new Map(),trackMids:new Map(),candidates:[],polite,remoteDescriptionSet:false,offerReady:forceOffer||!polite,makingOffer:false,ignoreOffer:false,restarting:false,recoveryTimer:null,negotiationPending:false,handlingRemoteDescription:false};
    peers.current.set(id,entry);
    tracePeer(entry,'peer created',{polite,offerer:entry.offerReady,forceOffer});
    const earlyCandidates=pendingCandidates.current.get(id);
    if(earlyCandidates){entry.candidates.push(...earlyCandidates);pendingCandidates.current.delete(id);tracePeer(entry,'early ICE candidates flushed',{count:earlyCandidates.length})}
    if(streamRef.current)for(const track of streamRef.current.getTracks())entry.cameraSenders.set(track.kind,pc.addTrack(track,streamRef.current));
    if(!streamRef.current?.getVideoTracks().length&&!screenStreamRef.current?.getVideoTracks().length)entry.cameraSenders.set('video',pc.addTransceiver('video',{direction:'sendrecv'}).sender);
    if(screenStreamRef.current?.getVideoTracks()[0]){entry.screenTransceiver=pc.addTransceiver(screenStreamRef.current.getVideoTracks()[0],{direction:'sendonly',streams:[screenStreamRef.current]});entry.screenSender=entry.screenTransceiver.sender;}

    pc.onicecandidate=(event)=>{if(event.candidate){tracePeer(entry,'ICE candidate sent');socket.emit('webrtc:ice-candidate',{to:id,candidate:event.candidate})}};
    pc.ontrack=(event)=>{
      const source=event.streams?.[0];
      tracePeer(entry,'track received',{kind:event.track.kind,trackId:event.track.id,mid:event.transceiver?.mid??null,streamId:source?.id||null});
      entry.trackMids.set(event.track.id,event.transceiver?.mid??null);
      if(source)entry.streams.set(source.id,source);
      else if(isScreenTrack(entry,event.track)){entry.screenFallbackStream||=new MediaStream();if(!entry.screenFallbackStream.getTracks().some((track)=>track.id===event.track.id))entry.screenFallbackStream.addTrack(event.track);entry.streams.set(entry.screenFallbackStream.id,entry.screenFallbackStream);entry.screenStreamId=entry.screenFallbackStream.id;}
      else if(!entry.fallbackStream.getTracks().some((track)=>track.id===event.track.id))entry.fallbackStream.addTrack(event.track);
      event.track.onmute=publish;
      event.track.onunmute=publish;
      event.track.onended=publish;
      tracePeer(entry,'track mapped to remote socket stream',{streamId:source?.id||entry.screenFallbackStream?.id||entry.fallbackStream.id});
      publish();
    };
    const negotiate=async()=>{
      if(!entry.negotiationPending||(!entry.offerReady&&!entry.remoteDescriptionSet)||entry.makingOffer||entry.handlingRemoteDescription||pc.signalingState!=='stable')return;
      entry.negotiationPending=false;entry.makingOffer=true;
      try{tracePeer(entry,'createOffer requested');await pc.setLocalDescription();tracePeer(entry,'setLocalDescription completed',{type:pc.localDescription?.type});if(pc.localDescription?.type==='offer'){const payload={to:id,offer:pc.localDescription};if(entry.screenTransceiver?.mid!=null)payload.screenMid=entry.screenTransceiver.mid;socket.emit('webrtc:offer',payload);tracePeer(entry,'offer sent')}}
      catch{entry.negotiationPending=true;failureRef.current('Unable to negotiate a peer connection.');}
      finally{entry.makingOffer=false;if(entry.negotiationPending&&pc.signalingState==='stable')queueMicrotask(negotiate);}
    };
    entry.negotiate=negotiate;
    pc.onnegotiationneeded=()=>{if(!entry.offerReady&&!entry.remoteDescriptionSet){entry.negotiationPending=Boolean(entry.screenTransceiver?.sender.track&&entry.screenTransceiver.direction!=='inactive');return}entry.negotiationPending=true;negotiate();};
    pc.onsignalingstatechange=()=>{if(pc.signalingState==='stable')negotiate();};
    // Elect one initial offerer per socket pair to avoid simultaneous offers.
    if(entry.offerReady){entry.negotiationPending=true;negotiate();}
    else if(entry.screenTransceiver?.sender.track&&entry.screenTransceiver.direction!=='inactive')entry.negotiationPending=true;
    pc.onconnectionstatechange=()=>{
      tracePeer(entry,'connectionstatechange');
      if(pc.connectionState==='connected'){entry.restarting=false;if(entry.recoveryTimer){clearTimeout(entry.recoveryTimer);entry.recoveryTimer=null}return}
      if(pc.connectionState==='failed'&&!entry.restarting){entry.restarting=true;try{pc.restartIce()}catch{failureRef.current('A peer connection could not be restored.')}}
      if((pc.connectionState==='failed'||pc.signalingState==='closed')&&!entry.recoveryTimer){entry.recoveryTimer=setTimeout(()=>{entry.recoveryTimer=null;if(peers.current.get(id)!==entry)return;if(pc.connectionState==='failed'||pc.signalingState==='closed'){const peerUser=entry.user;closePeer(id);getPeer(id,peerUser,true)}else entry.restarting=false},4000)}
    };
    pc.oniceconnectionstatechange=()=>tracePeer(entry,'iceconnectionstatechange');
    return entry;
  },[socket,publish,closePeer]);

  const registerRemoteScreenShare=useCallback((socketId,share)=>{
    if(share)knownScreenShares.current.set(socketId,{streamId:share.streamId,trackId:share.trackId});else knownScreenShares.current.delete(socketId);
    const entry=peers.current.get(socketId);
    if(!entry){publish();return;}
    if(share){entry.screenStreamId=share.streamId||null;entry.screenTrackId=share.trackId||null;entry.screenShareActive=true;}
    else entry.screenShareActive=false;
    publish();
  },[publish]);

  const startScreenShare=useCallback(async(screenStream)=>{
    const track=screenStream?.getVideoTracks()[0];
    if(!track)throw new Error('No screen video track is available');
    screenStreamRef.current=screenStream;
    const updated=[];
    try{
      for(const entry of peers.current.values()){
        if(entry.screenTransceiver){
          await entry.screenSender.replaceTrack(track);
          entry.screenTransceiver.direction='sendonly';
        }else{
          entry.screenTransceiver=entry.pc.addTransceiver(track,{direction:'sendonly',streams:[screenStream]});
          entry.screenSender=entry.screenTransceiver.sender;
        }
        entry.negotiationPending=true;
        entry.negotiate();
        updated.push(entry);
      }
    }catch(error){
      await Promise.all(updated.map(async(entry)=>{
        try{await entry.screenSender.replaceTrack(null);entry.screenTransceiver.direction='inactive';}catch{}
      }));
      screenStreamRef.current=null;
      throw error;
    }
    return {streamId:screenStream.id,trackId:track.id};
  },[]);

  const stopScreenShare=useCallback(async()=>{
    screenStreamRef.current=null;
    await Promise.all([...peers.current.values()].map(async(entry)=>{
      if(!entry.screenTransceiver)return;
      try{await entry.screenSender.replaceTrack(null);entry.screenTransceiver.direction='inactive';entry.negotiationPending=true;entry.negotiate();}
      catch{failureRef.current('Unable to stop the outgoing screen track.');}
    }));
  },[]);

  useEffect(()=>{
    if(!socket)return undefined;
    const participants=(list)=>{
      if(!Array.isArray(list))return;
      for(const participant of list)if(participant.socketId&&participant.socketId!==socket.id)getPeer(participant.socketId,participant.user);
    };
    const joined=({socketId,user})=>{if(socketId&&socketId!==socket.id)getPeer(socketId,user)};
    const left=({socketId})=>{if(socketId)closePeer(socketId)};
    const removed=({userId})=>{
      if(!userId)return;
      for(const [id,entry] of peers.current)if(String(entry.user?.id||entry.user?._id)===String(userId))closePeer(id);
    };
    const offer=async({from,offer:description,screenMid})=>{
      if(!from||!description)return;
      const entry=getPeer(from);
      if(!entry)return;
      const pc=entry.pc;
      tracePeer(entry,'offer received',{type:description.type});
      const collision=description.type==='offer'&&(entry.makingOffer||pc.signalingState!=='stable');
      entry.ignoreOffer=!entry.polite&&collision;
      if(entry.ignoreOffer){entry.candidates.length=0;return}
      entry.handlingRemoteDescription=true;
      try{
        if(typeof screenMid==='string')entry.screenMid=screenMid;
        if(collision)await pc.setLocalDescription({type:'rollback'});
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        entry.remoteDescriptionSet=true;
        tracePeer(entry,'setRemoteDescription completed',{type:description.type});
        if(typeof screenMid==='string')publish();
        const queued=entry.candidates.splice(0);for(const candidate of queued)await pc.addIceCandidate(candidate);if(queued.length)tracePeer(entry,'queued ICE candidates flushed',{count:queued.length});
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        tracePeer(entry,'setLocalDescription completed',{type:pc.localDescription?.type});
        socket.emit('webrtc:answer',{to:from,answer:pc.localDescription});
        tracePeer(entry,'answer sent');
      }catch{failureRef.current('Could not connect to a participant.')}
      finally{entry.handlingRemoteDescription=false;if(entry.negotiationPending&&pc.signalingState==='stable')queueMicrotask(entry.negotiate)}
    };
    const answer=async({from,answer:description})=>{
      const entry=peers.current.get(from);
      if(!entry||!description)return;
      tracePeer(entry,'answer received',{type:description.type});
      entry.handlingRemoteDescription=true;
      try{
        await entry.pc.setRemoteDescription(new RTCSessionDescription(description));
        entry.remoteDescriptionSet=true;
        tracePeer(entry,'setRemoteDescription completed',{type:description.type});
        const queued=entry.candidates.splice(0);for(const candidate of queued)await entry.pc.addIceCandidate(candidate);if(queued.length)tracePeer(entry,'queued ICE candidates flushed',{count:queued.length});
      }catch{failureRef.current('Could not complete the peer connection.')}
      finally{entry.handlingRemoteDescription=false;if(entry.negotiationPending&&entry.pc.signalingState==='stable')queueMicrotask(entry.negotiate)}
    };
    const ice=async({from,candidate})=>{
      if(!from||!candidate)return;
      try{
        const iceCandidate=new RTCIceCandidate(candidate);
        const entry=peers.current.get(from);
        if(!entry){const queued=pendingCandidates.current.get(from)||[];queued.push(iceCandidate);pendingCandidates.current.set(from,queued);traceSignal(socket.id,from,'ICE candidate queued before peer creation',{count:queued.length});return}
        if(entry.ignoreOffer)return;
        tracePeer(entry,'ICE candidate received');
        if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(iceCandidate);
        else{entry.candidates.push(iceCandidate);tracePeer(entry,'ICE candidate queued',{count:entry.candidates.length})}
      }catch{failureRef.current('A network path could not be added.')}
    };
    const disconnected=()=>{for(const id of [...peers.current.keys()])closePeer(id);pendingCandidates.current.clear();knownScreenShares.current.clear()};
    socket.on('meeting:participants',participants);
    socket.on('participant:joined',joined);
    socket.on('participant:left',left);
    socket.on('participant:removed',removed);
    socket.on('webrtc:offer',offer);
    socket.on('webrtc:answer',answer);
    socket.on('webrtc:ice-candidate',ice);
    socket.on('disconnect',disconnected);
    participants(participantsList||[]);
    return()=>{
      socket.off('meeting:participants',participants);
      socket.off('participant:joined',joined);
      socket.off('participant:left',left);
      socket.off('participant:removed',removed);
      socket.off('webrtc:offer',offer);
      socket.off('webrtc:answer',answer);
      socket.off('webrtc:ice-candidate',ice);
      socket.off('disconnect',disconnected);
      for(const id of [...peers.current.keys()])closePeer(id);
      pendingCandidates.current.clear();
      knownScreenShares.current.clear();
      setRemoteStreams({});
      setRemoteScreenStreams({});
    };
  },[socket,meetingCode,getPeer,closePeer]);

  useEffect(()=>{
    if(!stream)return;
    for(const entry of peers.current.values())for(const track of stream.getTracks()){
      const cameraSender=entry.cameraSenders.get(track.kind);
      if(cameraSender)cameraSender.replaceTrack(track).catch(()=>failureRef.current('Unable to update local media.'));
      else entry.cameraSenders.set(track.kind,entry.pc.addTrack(track,stream));
    }
  },[stream]);

  const removeUser=useCallback((userId)=>{
    for(const [id,entry] of peers.current)if(String(entry.user?.id||entry.user?._id)===String(userId))closePeer(id);
  },[closePeer]);
  const closeAll=useCallback(()=>{for(const id of [...peers.current.keys()])closePeer(id)},[closePeer]);
  const recoverFailedPeers=useCallback(()=>{for(const [id,entry] of peers.current){if(entry.pc.connectionState!=='failed'&&entry.pc.signalingState!=='closed')continue;const peerUser=entry.user;closePeer(id);getPeer(id,peerUser,true)}},[closePeer,getPeer]);
  return {remoteStreams,remoteScreenStreams,registerRemoteScreenShare,startScreenShare,stopScreenShare,removeUser,closeAll,recoverFailedPeers};
}
