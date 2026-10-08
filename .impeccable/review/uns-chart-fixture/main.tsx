import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import UNSExplorerPanel from '../../../src/components/UNSExplorerPanel';
import '../../../src/components/uns-workspace.css';
document.body.style.cssText = 'margin:0;background:#0c171f;color:#eef5f7;font-family:Inter Variable,sans-serif;';
createRoot(document.getElementById('root')!).render(<><UNSExplorerPanel open onClose={() => {}} /><div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,padding:'3px 12px',fontSize:11,background:'#223d4a',color:'#c9dae1',textAlign:'center'}}>UI validation fixture · test data, not live telemetry</div></>);
