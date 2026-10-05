import { Link } from 'react-router-dom';

export default function Brand({ to = '/', light = false }) {
  return <Link to={to} className={`brand-lockup ${light ? 'brand-light' : ''}`} aria-label="AuraMeet home"><span className="brand-mark"><i className="bi bi-camera-video-fill" /></span><span>Aura<span>Meet</span></span></Link>;
}
