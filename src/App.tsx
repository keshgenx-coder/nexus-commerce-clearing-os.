import React, { useEffect } from 'react';
import { NexusV4Master } from './components/NexusV4/NexusV4Master';

export function App() {
  useEffect(() => {
    document.documentElement.className = 'dark theme-dark bg-[#080C14] text-slate-100';
  }, []);

  return <NexusV4Master />;
}

export default App;
