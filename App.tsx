import React, { useState, useEffect } from 'react';
import WebcamProcessor from './components/WebcamProcessor';
import { DetectionStats, AlertLog, EMERGENCY_CONTACTS, DriverState } from './types';
import { Activity, Eye, Heart, List, Shield, Play, Square, AlertTriangle, Phone, Video } from 'lucide-react';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [active, setActive] = useState(false);
  const [stats, setStats] = useState<DetectionStats>({
    ear: 0, mar: 0, blinkCount: 0, yawnCount: 0, drowsyCount: 0, heartRate: 78, expression: 'Neutral'
  });
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleLogEntry = (log: AlertLog) => {
    setLogs(prev => [log, ...prev].slice(0, 50)); // Keep last 50
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    const result = await geminiService.processStats(stats, logs);
    setReport(result);
    setIsGeneratingReport(false);
  };

  return (
    <div className="min-h-screen bg-hud-black text-white p-6 font-sans selection:bg-hud-green selection:text-black">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-hud-green" />
          <h1 className="text-2xl font-bold tracking-widest uppercase text-white">Sentinel <span className="text-hud-green text-sm normal-case font-mono border border-hud-green/30 px-2 py-0.5 rounded ml-2">v2.1</span></h1>
        </div>
        <button
          onClick={() => setActive(!active)}
          className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${
            active 
            ? 'bg-hud-red/10 text-hud-red border border-hud-red/50 hover:bg-hud-red/20' 
            : 'bg-hud-green text-black hover:bg-hud-green/90 shadow-[0_0_20px_rgba(0,255,157,0.3)]'
          }`}
        >
          {active ? <><Square className="w-4 h-4 fill-current" /> STOP MONITOR</> : <><Play className="w-4 h-4 fill-current" /> START MONITOR</>}
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visuals */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <WebcamProcessor 
            active={active} 
            onStatsUpdate={setStats} 
            onLogEntry={handleLogEntry}
          />

          {/* Real-time Metrics Graph/Bars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-hud-blue mb-2">
                  <Eye className="w-4 h-4" /> <span className="text-xs font-mono uppercase">EAR (Eyes)</span>
                </div>
                <div className="text-2xl font-mono font-bold">{stats.ear.toFixed(2)}</div>
                <div className="w-full bg-white/10 h-1 mt-2 rounded-full overflow-hidden">
                  <div className="h-full bg-hud-blue transition-all duration-300" style={{ width: `${Math.min(stats.ear * 300, 100)}%` }}></div>
                </div>
             </div>

             <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-hud-yellow mb-2">
                  <Activity className="w-4 h-4" /> <span className="text-xs font-mono uppercase">MAR (Mouth)</span>
                </div>
                <div className="text-2xl font-mono font-bold">{stats.mar.toFixed(2)}</div>
                 <div className="w-full bg-white/10 h-1 mt-2 rounded-full overflow-hidden">
                  <div className="h-full bg-hud-yellow transition-all duration-300" style={{ width: `${Math.min(stats.mar * 150, 100)}%` }}></div>
                </div>
             </div>

             <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-hud-red mb-2">
                  <Heart className="w-4 h-4" /> <span className="text-xs font-mono uppercase">Heart Rate</span>
                </div>
                <div className="text-2xl font-mono font-bold">{stats.heartRate} <span className="text-sm text-white/50">BPM</span></div>
             </div>
             
             <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-purple-400 mb-2">
                  <AlertTriangle className="w-4 h-4" /> <span className="text-xs font-mono uppercase">Alerts</span>
                </div>
                <div className="text-2xl font-mono font-bold text-purple-400">{stats.drowsyCount + stats.yawnCount}</div>
             </div>
          </div>
        </div>

        {/* Right Column: Info & Logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Emergency Contacts */}
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-mono text-hud-green uppercase tracking-wider mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Emergency Contacts
            </h3>
            <div className="space-y-3">
              {EMERGENCY_CONTACTS.map((contact, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-black/40 rounded-lg border border-white/5 hover:border-hud-green/30 transition-colors cursor-pointer group">
                  <div>
                    <div className="font-bold text-sm">{contact.name}</div>
                    <div className="text-xs text-white/50 font-mono">{contact.phone}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-hud-green/10 flex items-center justify-center text-hud-green group-hover:bg-hud-green group-hover:text-black transition-all">
                    <Phone className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gemini AI Analysis */}
          <div className="bg-gradient-to-br from-indigo-900/20 to-black border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Shield className="w-32 h-32" />
             </div>
             <h3 className="text-sm font-mono text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
               AI Safety Report
             </h3>
             
             {!report ? (
               <div className="text-center py-6">
                 <p className="text-sm text-white/60 mb-4">Monitor your driving to generate an AI safety analysis.</p>
                 <button 
                  disabled={isGeneratingReport || stats.drowsyCount + stats.yawnCount === 0}
                  onClick={generateReport}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                 >
                   {isGeneratingReport ? 'Analyzing...' : 'Generate Report'}
                 </button>
               </div>
             ) : (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                 <p className="text-sm leading-relaxed text-indigo-100 font-light border-l-2 border-indigo-500 pl-3">
                   {report}
                 </p>
                 <button onClick={() => setReport(null)} className="text-xs text-indigo-400 mt-4 hover:text-indigo-200">Clear Report</button>
               </div>
             )}
          </div>

          {/* Event Log */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex-1 min-h-[300px] overflow-hidden flex flex-col">
             <h3 className="text-sm font-mono text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <List className="w-4 h-4" /> Live Events
            </h3>
            <div className="overflow-y-auto space-y-2 flex-1 pr-2">
              {logs.length === 0 && <div className="text-xs text-white/30 italic">No events detected yet.</div>}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 text-xs border-l border-white/10 pl-3 py-1">
                  <span className="font-mono text-white/40">{log.timestamp}</span>
                  <span className={`${
                    (log.type === DriverState.DROWSY || log.type === DriverState.NODDING) ? 'text-hud-red font-bold' : 
                    log.type === DriverState.YAWNING ? 'text-hud-yellow' : 'text-hud-green'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-white/60 truncate">{log.details}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;