import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Brand from '../components/common/Brand';
import useAuth from '../hooks/useAuth';
import { apiErrorMessage } from '../api/axios';
import { validatePassword, validateUsername } from '../utils/validation';

export default function Login() {
  const { user, login } = useAuth(); const navigate = useNavigate();
  const [form,setForm]=useState({username:'',password:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  if(user)return <Navigate to="/dashboard" replace/>;
  const update=(e)=>setForm({...form,[e.target.name]:e.target.value});
  const submit=async(e)=>{e.preventDefault();setError('');if(!validateUsername(form.username)){setError('Enter a valid username (3–30 letters, numbers, dots, or underscores).');return}if(!validatePassword(form.password)){setError('Your password must be between 8 and 72 bytes.');return}setBusy(true);try{await login(form);navigate('/dashboard',{replace:true})}catch(err){setError(apiErrorMessage(err,'Unable to sign in.'))}finally{setBusy(false)}};
  return <div className="auth-page"><div className="surface-card auth-card"><div className="mb-4"><Brand/><h1>Welcome back</h1><p className="helper">Sign in to pick up where you left off.</p></div>{error&&<div className="alert alert-danger py-2 small" role="alert">{error}</div>}<form onSubmit={submit}><div className="mb-3"><label htmlFor="username" className="form-label">Username</label><input id="username" name="username" autoComplete="username" className="form-control" value={form.username} onChange={update} required /></div><div className="mb-4"><label htmlFor="password" className="form-label">Password</label><input id="password" name="password" type="password" autoComplete="current-password" className="form-control" value={form.password} onChange={update} required /></div><button className="btn btn-primary w-100 py-2" disabled={busy}>{busy?<><span className="spinner-border spinner-border-sm me-2"/>Signing in…</>:'Sign in'}</button></form><div className="auth-switch text-center mt-4">New to AuraMeet? <Link to="/register">Create an account</Link></div></div></div>;
}
