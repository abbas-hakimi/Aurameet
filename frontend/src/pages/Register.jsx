import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Brand from '../components/common/Brand';
import useAuth from '../hooks/useAuth';
import { apiErrorMessage } from '../api/axios';
import { validatePassword, validateUsername } from '../utils/validation';

export default function Register() {
  const {user,register}=useAuth();const navigate=useNavigate();const [form,setForm]=useState({name:'',username:'',password:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  if(user)return <Navigate to="/dashboard" replace/>;
  const update=(e)=>setForm({...form,[e.target.name]:e.target.value});
  const submit=async(e)=>{e.preventDefault();setError('');if(!form.name.trim()||form.name.trim().length>80){setError('Enter your name (up to 80 characters).');return}if(!validateUsername(form.username)){setError('Username must be 3–30 letters, numbers, dots, or underscores.');return}if(!validatePassword(form.password)){setError('Password must be at least 8 characters and no more than 72 bytes.');return}setBusy(true);try{await register({...form,name:form.name.trim(),username:form.username.trim().toLowerCase()});navigate('/dashboard',{replace:true})}catch(err){setError(apiErrorMessage(err,'Unable to create your account.'))}finally{setBusy(false)}};
  return <div className="auth-page"><div className="surface-card auth-card"><div className="mb-4"><Brand/><h1>Make room to meet</h1><p className="helper">Create an account to host your next conversation.</p></div>{error&&<div className="alert alert-danger py-2 small" role="alert">{error}</div>}<form onSubmit={submit}><div className="mb-3"><label htmlFor="name" className="form-label">Your name</label><input id="name" name="name" autoComplete="name" maxLength="80" className="form-control" value={form.name} onChange={update} required /></div><div className="mb-3"><label htmlFor="username" className="form-label">Username</label><input id="username" name="username" autoComplete="username" maxLength="30" className="form-control" value={form.username} onChange={update} required /><div className="form-text">3–30 characters: letters, numbers, dots, or underscores.</div></div><div className="mb-4"><label htmlFor="password" className="form-label">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength="8" className="form-control" value={form.password} onChange={update} required /></div><button className="btn btn-primary w-100 py-2" disabled={busy}>{busy?<><span className="spinner-border spinner-border-sm me-2"/>Creating account…</>:'Create account'}</button></form><div className="auth-switch text-center mt-4">Already have an account? <Link to="/login">Sign in</Link></div></div></div>;
}
