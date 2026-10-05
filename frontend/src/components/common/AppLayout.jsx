import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Brand from './Brand';
import useAuth from '../../hooks/useAuth';
import { initials } from '../../utils/validation';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetingRoomActive, setMeetingRoomActive] = useState(false);
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  return <div className="app-shell">
    {!meetingRoomActive&&<header className="site-header"><div className="container-xl d-flex align-items-center justify-content-between"><Brand to={user ? '/dashboard' : '/'} />
      <nav className="d-flex align-items-center gap-3">
        {user ? <><NavLink className="header-link" to="/dashboard">My meetings</NavLink><div className="dropdown"><button className="profile-button" data-bs-toggle="dropdown" aria-expanded="false"><span className="avatar avatar-sm">{initials(user.name)}</span><span className="d-none d-sm-inline">{user.name}</span><i className="bi bi-chevron-down small" /></button><ul className="dropdown-menu dropdown-menu-end shadow-sm border-0"><li><span className="dropdown-item-text small text-secondary">@{user.username}</span></li><li><button className="dropdown-item" onClick={signOut}><i className="bi bi-box-arrow-right me-2" />Sign out</button></li></ul></div></> : <><Link className="header-link" to="/login">Sign in</Link><Link className="btn btn-primary btn-sm px-3" to="/register">Get started</Link></>}
      </nav>
    </div></header>}
    <main><Outlet context={{setMeetingRoomActive}} /></main>
    {!meetingRoomActive&&<footer className="site-footer"><div className="container-xl d-flex justify-content-between"><span>© {new Date().getFullYear()} AuraMeet</span><span>Make room for better conversations.</span></div></footer>}
  </div>;
}
