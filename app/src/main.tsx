import { StrictMode, useEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import Landing from './landing/Landing';

const Review = lazy(() => import('./App'));
const route = () => (location.hash.startsWith('#/review') ? 'review' : 'landing');

function Root() {
  const [r, setR] = useState(route);
  useEffect(() => { const on = () => setR((prev) => { const next = route(); if (next !== prev) scrollTo(0, 0); return next; }); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  useEffect(() => { document.title = r === 'review' ? 'Review a game · Fianco' : 'Fianco · Free, unlimited chess game review'; }, [r]);
  return r === 'review' ? <Suspense fallback={null}><Review /></Suspense> : <Landing />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
