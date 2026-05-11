import { useEffect, useState } from 'react';

export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#home');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return hash;
}
