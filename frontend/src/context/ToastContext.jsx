import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() });
    window.setTimeout(() => setToast(null), 4200);
  }, []);
  return <ToastContext.Provider value={showToast}>
    {children}
    {toast && <div className={`toast-card toast-${toast.tone}`} role="status"><span className="toast-mark"><i className={`bi ${toast.tone === 'danger' ? 'bi-exclamation-circle' : toast.tone === 'success' ? 'bi-check-circle' : 'bi-info-circle'}`} /></span><span>{toast.message}</span><button className="btn-close ms-auto" aria-label="Dismiss" onClick={() => setToast(null)} /></div>}
  </ToastContext.Provider>;
}
