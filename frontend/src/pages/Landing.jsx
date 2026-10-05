import { Link, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <>
    <section className="landing-hero"><div className="container-xl"><div className="row align-items-center gy-4"><div className="col-lg-7">
      <span className="eyebrow"><i className="bi bi-stars me-2" />Good conversations start here</span>
      <h1 className="hero-title">Meet face to face,<br /><em>from anywhere.</em></h1>
      <p className="hero-copy">A calmer space for team check-ins, thoughtful collaboration, and the people you want to bring together.</p>
      <div className="d-flex flex-wrap gap-2 mt-4"><Link className="btn btn-primary btn-lg px-4" to="/register">Create your account <i className="bi bi-arrow-right ms-2" /></Link><Link className="btn btn-outline-secondary btn-lg px-4" to="/login">Sign in</Link></div>
      <div className="d-flex align-items-center gap-2 mt-4 small text-secondary"><i className="bi bi-shield-check text-primary" />Private by default · Simple to join · Built for real conversations</div>
    </div><div className="col-lg-5"><div className="hero-visual"><div className="hero-glow" /><div className="hero-window"><div className="hero-window-top"><span><i className="bi bi-record-circle-fill text-danger me-2" />Weekly team sync</span><span>00:24:18</span></div><div className="hero-tiles"><div className="hero-tile"><span>Alex Morgan</span></div><div className="hero-tile"><span>Riley Chen</span></div><div className="hero-tile"><span>Sam Patel</span></div><div className="hero-tile"><span>Jordan Lee</span></div></div><div className="hero-controls"><i className="bi bi-mic-mute-fill mx-2" /><i className="bi bi-camera-video-fill mx-2" /><i className="bi bi-display mx-2" /><i className="bi bi-telephone-fill text-danger mx-2" /></div></div></div></div></div></div></section>
    <section className="feature-row"><div className="container-xl"><div className="row align-items-end mb-4"><div className="col-md-7"><span className="eyebrow">A better way to connect</span><h2 className="page-heading mt-2">Everything you need to meet well.</h2></div><div className="col-md-5 text-md-end text-secondary small">Less setup. More time for the conversation.</div></div><div className="row g-3">{[
      ['bi-camera-video','Clear video calls','Get together face to face with a meeting room that stays out of the way.'],['bi-people','Thoughtful controls','Manage participants, waiting rooms, chat, and screen sharing as a host.'],['bi-chat-dots','Stay in the flow','Share links, ideas, and context without leaving your conversation.']
    ].map(([icon,title,text])=><div className="col-md-4" key={title}><article className="surface-card feature-card"><div className="feature-icon"><i className={`bi ${icon}`} /></div><h3>{title}</h3><p>{text}</p></article></div>)}</div></div></section>
  </>;
}
