import { formatDate, initials } from '../../utils/validation';
import './WaitingRoom.css';

const displayValue=(value)=>typeof value==='string'&&value.trim()?value.trim():'';

function participantId(entry){
  const candidate=entry?.user?.id??entry?.user?._id??entry?.userId??entry?.user;
  if(typeof candidate==='string')return candidate;
  if(candidate&&typeof candidate.toHexString==='function')return candidate.toHexString();
  if(candidate&&typeof candidate.toString==='function'&&candidate.toString!==Object.prototype.toString){
    const value=candidate.toString();
    if(value&&value!=='[object Object]')return value;
  }
  return '';
}

function participantName(entry){
  return displayValue(entry?.user?.name)||displayValue(entry?.name)||displayValue(entry?.user?.username)||displayValue(entry?.username)||'Participant';
}

function participantUsername(entry){
  const username=displayValue(entry?.user?.username)||displayValue(entry?.username);
  return username?`@${username.replace(/^@/,'')}`:'';
}

export default function WaitingRoom({ meeting, waiting, isHost, onAdmit, onReject, onCancel, busyIds = [] }) {
  if (!isHost) return <div className="waiting-page"><div className="waiting-icon"><i className="bi bi-hourglass-split"/></div><span className="eyebrow">Almost there</span><h1 className="page-heading mt-2">Waiting for the host</h1><p className="muted mx-auto" style={{maxWidth:440}}>You’re in the waiting room for <strong>{meeting.title}</strong>. We’ll let you in as soon as the host admits you.</p><div className="d-flex justify-content-center align-items-center gap-2 small text-secondary mt-4"><span className="spinner-grow spinner-grow-sm text-primary"/>Waiting for admission</div><button className="btn btn-outline-secondary mt-4" onClick={onCancel}>Leave waiting room</button></div>;

  return <section className="waiting-admin-panel p-3 p-md-4">
    <div className="waiting-admin-heading">
      <div><span className="waiting-admin-eyebrow">Host controls</span><h2 className="h5 fw-bold mt-2 mb-1">Waiting room</h2><p className="waiting-admin-muted mb-0">Review people before letting them in.</p></div>
      <span className="waiting-count">{waiting.length} waiting</span>
    </div>
    {waiting.length===0?<div className="waiting-empty">No one is waiting to join right now.</div>:<div className="waiting-list">{waiting.map((entry,index)=>{
      const id=participantId(entry);
      const name=participantName(entry);
      const username=participantUsername(entry);
      const busy=busyIds.some((busyId)=>String(busyId)===id);
      return <div className="waiting-person" key={id||index}>
        <div className="waiting-person-info">
          <span className="waiting-avatar">{initials(name)}</span>
          <div className="waiting-person-copy">
            <strong className="waiting-person-name">{name}</strong>
            {username&&username.toLowerCase()!==name.toLowerCase()&&<span className="waiting-person-username">{username}</span>}
            <span className="waiting-requested">Requested {formatDate(entry.requestedAt)}</span>
          </div>
        </div>
        <div className="waiting-person-actions">
          <button className="waiting-reject" disabled={!id||busy} onClick={()=>onReject(id)} aria-label={`Reject ${name}`} title="Reject participant"><i className="bi bi-x-lg"/></button>
          <button className="waiting-admit" disabled={!id||busy} onClick={()=>onAdmit(id)}>{busy?<span className="spinner-border spinner-border-sm" aria-label="Processing"/>:'Admit'}</button>
        </div>
      </div>;
    })}</div>}
  </section>;
}
