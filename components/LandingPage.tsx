/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, BrainCircuit, ShieldCheck, Target, Flame, ChevronDown, User, Coins, LogIn, LogOut, Users, X, Shield } from 'lucide-react';
import { GameMode, ScoreService, UserProfile, UNLOCK_THRESHOLDS } from '../services/ScoreService';
import { auth, signInWithGoogle } from '../services/firebase';
// Standard Firebase Auth listener for real-time identity updates
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import PrivacyPolicy from './PrivacyPolicy';

interface LandingPageProps {
  onStartGame: (mode: GameMode, config?: { p1: string, p2?: string, isMulti: boolean }) => void;
  onViewDashboard: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartGame, onViewDashboard }) => {
  const [profile, setProfile] = useState<UserProfile>(ScoreService.getLocalProfile());
  const [alias, setAlias] = useState(profile.alias);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showMultiplayerSetup, setShowMultiplayerSetup] = useState(false);
  const [showSoloSetup, setShowSoloSetup] = useState(false);
  const [p1Name, setP1Name] = useState('Ace One');
  const [p2Name, setP2Name] = useState('Ace Two');
  const [soloName, setSoloName] = useState('Pilot One');

  // ==========================================
  // IDENTITY & SYNC REGISTRY
  // ==========================================

  /**
   * Monitor authentication state and synchronize the user profile
   * between the cloud and local storage layers. 
   * This is the "Heartbeat" of the user's session.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const cloudProfile = await ScoreService.getProfile(firebaseUser.uid);
        if (cloudProfile) {
          setProfile(cloudProfile);
          setAlias(cloudProfile.alias);
          setSoloName(cloudProfile.alias || 'Pilot One');
          localStorage.setItem('gemini_slingshot_user', JSON.stringify(cloudProfile));
        } else {
          // New user, push local profile to cloud
          const nameToUse = alias || firebaseUser.displayName || 'Pilot One';
          const newProfile = { ...profile, alias: nameToUse };
          await ScoreService.syncProfile(newProfile);
          setProfile(newProfile);
          setSoloName(nameToUse);
        }
      } else {
        // Reset to local if logged out
        setProfile(ScoreService.getLocalProfile());
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Authentication Gateway:
   * Triggers the Google Auth flow and initiates profile data reconciliation.
   */
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  /**
   * Session Termination:
   * Clears the authentication state and reverts to the local pilot profile.
   */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      const local = ScoreService.getLocalProfile();
      setProfile(local);
      setAlias(local.alias);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleStart = async (mode: GameMode, isMulti: boolean) => {
    if (!user) return;
    
    // Check requirements
    if (profile.coins < UNLOCK_THRESHOLDS[mode]) {
        console.warn(`Mode ${mode} is locked. Required: ${UNLOCK_THRESHOLDS[mode]}, Current: ${profile.coins}`);
        return;
    }

    if (isMulti) {
      onStartGame(mode, { p1: p1Name, p2: p2Name, isMulti: true });
      setShowMultiplayerSetup(false);
    } else {
      // Save updated alias for solo
      const updated = { ...profile, alias: soloName || 'Pilot One' };
      localStorage.setItem('gemini_slingshot_user', JSON.stringify(updated));
      await ScoreService.syncProfile(updated);
      onStartGame(mode, { p1: soloName || 'Pilot One', isMulti: false });
      setShowSoloSetup(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrainCircuit className="text-purple-400 animate-pulse" size={48} />
          <div className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Initializing Protocol...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen bg-[#0a0502] flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0 opacity-40">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#1a1033_0%,#0a0502_100%)]" />
           <div className="grid grid-cols-10 gap-1 opacity-20 h-full">
              {[...Array(100)].map((_, i) => (
                <div key={i} className="border-r border-b border-white/5" />
              ))}
           </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 rounded-[48px] p-12 backdrop-blur-3xl shadow-2xl text-center"
        >
          <div className="inline-flex p-5 rounded-3xl bg-blue-500/20 border border-blue-500/30 text-blue-400 mb-8 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <ShieldCheck size={40} />
          </div>
          
          <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">Gemine Vision Strike</h1>
          <p className="text-white/40 text-sm mb-12 italic">Tactical Authorization Required</p>

          <div className="relative w-full aspect-video rounded-3xl overflow-hidden mb-12 border border-white/10 group bg-black/40">
             <img 
               src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop" 
               alt="Gemine Vision Strike" 
               className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
               onError={(e) => {
                 (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop';
               }}
               referrerPolicy="no-referrer"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent" />
             <div className="absolute bottom-6 left-6 right-6">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Protocol V5.0 Activated</div>
                <div className="text-lg font-black uppercase text-white tracking-widest italic">Precision Strike. Tactical Dominance.</div>
             </div>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[32px] font-black uppercase tracking-[0.2em] text-sm transition-all shadow-[0_0_40px_rgba(37,99,235,0.4)] active:scale-95"
          >
            <LogIn size={20} />
            Initialize Protocol
          </button>

          <div className="mt-12 flex items-center justify-center gap-4 text-white/20">
             <div className="h-[1px] w-8 bg-white/10" />
             <span className="text-[10px] font-bold uppercase tracking-widest">Secure Handshake</span>
             <div className="h-[1px] w-8 bg-white/10" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0a0502] text-white overflow-x-hidden selection:bg-purple-500/30">
      {/* Animated Deep Space Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1033_0%,#0a0502_100%)]" />
        
        {/* Floating Particle Stars */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0.2, 0.5, 0.2],
              y: [0, -100, 0],
              x: [0, i % 2 === 0 ? 50 : -50, 0]
            }}
            transition={{ 
              duration: 10 + Math.random() * 20, 
              repeat: Infinity,
              ease: "linear" 
            }}
            className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}

        {/* Themed Gradient Overlays */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0502] via-transparent to-[#0a0502]" />
      </div>

      {/* Profile Bar */}
      <div className="fixed top-0 right-0 p-6 z-[60] flex gap-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-6 pointer-events-auto shadow-2xl"
          >
             {!user ? (
               <button 
                 onClick={handleLogin}
                 className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
               >
                 <LogIn size={14} />
                 Sign In
               </button>
             ) : (
               <button 
                 onClick={handleLogout}
                 className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all border border-white/5"
                 title="Logout"
               >
                 <LogOut size={16} />
               </button>
             )}

             <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${user ? 'bg-blue-500/20 border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
                    ) : (
                      <User className="text-blue-400" size={20} />
                    )}
                </div>
                <div>
                   <input 
                     type="text" 
                     value={alias}
                     onChange={(e) => setAlias(e.target.value)}
                     className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-black uppercase tracking-widest w-24 p-0 text-blue-400"
                     placeholder="ID: PILOT"
                     disabled={!user}
                   />
                   <div className="text-[10px] text-white/30 uppercase font-bold">Tactical Identifier</div>
                </div>
             </div>
             
             <div className="h-10 w-[1px] bg-white/10" />

             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
                    <Coins className="text-yellow-500" size={20} />
                </div>
                <div>
                   <div className="text-sm font-black uppercase text-yellow-500">{profile.coins.toLocaleString()}</div>
                   <div className="text-[10px] text-white/30 uppercase font-bold">Credits</div>
                </div>
             </div>
          </motion.div>
      </div>

      {/* Hero Content */}
      <section className="relative z-10 h-screen flex flex-col items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
             initial={{ scale: 0.8, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-8"
          >
            <BrainCircuit size={14} className="text-purple-400" />
            AI-Enhanced Tactical Shooter
          </motion.div>
          
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.8] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            GEMINE<br />VISION STRIKE
          </h1>
          
          <p className="max-w-xl mx-auto text-lg md:text-xl text-white/50 mb-4 font-medium leading-relaxed">
            Harness the tactical precision of <span className="text-white">Gemini AI</span>. Analyze the battlefield, execute perfect strikes, and dominate the global leaderboards.
          </p>
          
          <div className="mb-12 flex flex-col items-center gap-1">
             <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400/60">Architect & Lead Developer</div>
             <div className="text-sm font-bold text-white/80 tracking-widest uppercase">Nkululeko Khalishwayo</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
             <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSoloSetup(true)}
                className="flex items-center gap-3 px-10 py-5 rounded-3xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)]"
             >
                <Play size={20} />
                Solo Campaign
             </motion.button>
             
             <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMultiplayerSetup(true)}
                className="flex items-center gap-3 px-8 py-5 rounded-3xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-bold border border-purple-500/20 transition-all backdrop-blur-2xl"
             >
                <Users size={20} />
                Versus Duel
             </motion.button>

             <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onViewDashboard()}
                className="group relative flex items-center gap-3 px-8 py-5 rounded-3xl bg-white/5 hover:bg-white/10 backdrop-blur-2xl border border-white/10 transition-all overflow-hidden"
             >
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Trophy size={20} className="text-yellow-500" />
                <span className="font-bold text-white/80 uppercase text-xs tracking-widest">Hall of Fame</span>
             </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Multiplayer Setup Modal */}
      <AnimatePresence>
        {showMultiplayerSetup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMultiplayerSetup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a1033] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowMultiplayerSetup(false)} className="text-white/20 hover:text-white/60 transition-colors">
                  <X />
                </button>
              </div>

              <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-3xl bg-purple-500/20 border border-purple-500/30 text-purple-400 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                   <Users size={32} />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">2-Player Duel</h2>
                <p className="text-white/40 text-sm">Best out of 3 rounds. Enter callsigns to begin.</p>
              </div>

              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Pilot One Callsign</label>
                  <input 
                    type="text" 
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-purple-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Pilot Two Callsign</label>
                  <input 
                    type="text" 
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-purple-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Select Combat Zone</div>
                <div className="flex gap-4">
                  {(['easy', 'moderate', 'hard'] as GameMode[]).map((m) => {
                    const isLocked = profile.coins < UNLOCK_THRESHOLDS[m];
                    return (
                      <div key={m} className="flex-1 flex flex-col gap-2">
                        <button
                          disabled={isLocked}
                          onClick={() => handleStart(m, true)}
                          className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border relative ${
                            isLocked ? 'bg-black/40 border-white/5 text-white/10 cursor-not-allowed overflow-hidden' :
                            m === 'easy' ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500 hover:text-black shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
                            m === 'moderate' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                            'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                          }`}
                        >
                          {m}
                          {isLocked && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]"
                            >
                               <ShieldCheck size={14} className="text-white/20" />
                            </motion.div>
                          )}
                        </button>
                        {isLocked && (
                          <div className="text-[8px] font-black uppercase text-yellow-500/40 text-center tracking-tighter">
                            {UNLOCK_THRESHOLDS[m].toLocaleString()} CR
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Solo Setup Modal */}
      <AnimatePresence>
        {showSoloSetup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSoloSetup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#0d091a] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowSoloSetup(false)} className="text-white/20 hover:text-white/60 transition-colors">
                  <X />
                </button>
              </div>

              <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-3xl bg-blue-500/20 border border-blue-500/30 text-blue-400 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                   <Target size={32} />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Single Ops</h2>
                <p className="text-white/40 text-sm">Update your callsign and select mission depth.</p>
              </div>

              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Pilot Callsign</label>
                  <input 
                    type="text" 
                    value={soloName}
                    onChange={(e) => setSoloName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Select Mission Depth</div>
                <div className="flex gap-4">
                  {(['easy', 'moderate', 'hard'] as GameMode[]).map((m) => {
                    const isLocked = profile.coins < UNLOCK_THRESHOLDS[m];
                    return (
                      <div key={m} className="flex-1 flex flex-col gap-2">
                        <button
                          disabled={isLocked}
                          onClick={() => handleStart(m, false)}
                          className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border relative ${
                            isLocked ? 'bg-black/40 border-white/5 text-white/10 cursor-not-allowed overflow-hidden' :
                            m === 'easy' ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500 hover:text-black shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
                            m === 'moderate' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                            'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                          }`}
                        >
                          {m}
                          {isLocked && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]"
                            >
                               <ShieldCheck size={14} className="text-white/20" />
                            </motion.div>
                          )}
                        </button>
                        {isLocked && (
                          <div className="text-[8px] font-black uppercase text-yellow-500/40 text-center tracking-tighter">
                            {UNLOCK_THRESHOLDS[m].toLocaleString()} CR
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      </AnimatePresence>

      <footer className="relative z-20 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            layout
            className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
          >
            <button 
              onClick={() => setIsAboutExpanded(!isAboutExpanded)}
              className="w-full p-8 flex items-center justify-between text-left hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 p-3 rounded-2xl text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <BrainCircuit size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Mission Intelligence Report</h3>
                  <p className="text-white/40 text-sm">Developed by Nkululeko Khalishwayo • Google AI Studio Challenge</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isAboutExpanded ? 180 : 0 }}
                className="text-white/20 group-hover:text-white/60 transition-colors"
              >
                <ChevronDown size={24} />
              </motion.div>
            </button>

            <AnimatePresence>
              {isAboutExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="px-8 pb-12 pt-4 border-t border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                             <Target size={14} /> The Visionary
                          </h4>
                          <p className="text-white/60 leading-relaxed text-sm">
                            Created and engineered by <strong>Nkululeko Khalishwayo</strong>, Gemine Vision Strike was developed as a flagship project for the <strong>Google AI Studio Challenge</strong>. This application is a masterclass in merging <strong>Spatial AI</strong> with low-latency user interfaces to solve complex human-computer interaction challenges.
                          </p>
                        </div>
                        <div>
                          <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                             <BrainCircuit size={14} /> AI Integration & Workflow
                          </h4>
                          <p className="text-white/60 leading-relaxed text-sm">
                            The core logic utilizes <strong>Gemini 3 Flash</strong> to analyze board density and provide real-time strategic recommendations. Using Google AI Studio provided a powerful, intuitive environment that simplified complex API interactions, allowing me to focus on creating a high-performance experience.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                             <ShieldCheck size={14} /> Knowledge & Challenges
                          </h4>
                          <div className="text-white/60 leading-relaxed text-sm space-y-4">
                            <p>
                              Developing this game pushed my understanding of real-time physics and state synchronization. Balancing high-frequency Canvas updates with React&apos;s reactive lifecycle was a key technical challenge.
                            </p>
                            <p>
                              Integrating Firebase for persistent ranking ensures that every pilot&apos;s journey is tracked securely across sessions, providing a sense of progression from Cadet to Ace.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <div className="mt-12 flex flex-col items-center gap-4">
             <button 
               onClick={() => setShowPrivacy(true)}
               className="text-white/30 hover:text-blue-400 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5"
             >
               <Shield size={12} /> Privacy Policy
             </button>
             <p className="text-white/20 text-xs font-mono uppercase tracking-[0.3em]">
                Secure Sync Protocol v5.0.0 • Gemine Vision Strike
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModeCardProps {
  mode: GameMode;
  title: string;
  icon: React.ReactNode;
  description: string;
  stats: string[];
  onClick: () => void;
  isLocked: boolean;
  currentCoins: number;
  requiredCoins: number;
  showLoginPrompt: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({ 
  mode, title, icon, description, stats, onClick, isLocked, currentCoins, requiredCoins, showLoginPrompt 
}) => {
  const progress = Math.min(100, (currentCoins / requiredCoins) * 100);
  const remaining = Math.max(0, requiredCoins - currentCoins);

  return (
    <motion.div
      whileHover={!isLocked ? { y: -10 } : {}}
      className={`group relative h-full flex flex-col p-1 rounded-[40px] border transition-all overflow-hidden ${
        isLocked 
        ? 'bg-black/40 border-white/5 grayscale opacity-80' 
        : 'bg-white/5 backdrop-blur-2xl border-white/10 hover:border-white/30'
      }`}
    >
      {isLocked && !showLoginPrompt && remaining > 0 && (
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full z-20">
          <Coins size={12} className="text-yellow-500" />
          <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Locked</span>
        </div>
      )}

      <div className="p-8 flex-1">
        <div className={`mb-6 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
          isLocked ? 'bg-white/5 border-white/5' : 'bg-white/5 border-white/10 group-hover:scale-110'
        }`}>
          {isLocked ? <div className="text-white/20"><ShieldCheck size={24} /></div> : icon}
        </div>
        
        <div className="text-xs font-bold text-white/40 tracking-widest uppercase mb-2">{mode} Mode</div>
        <h3 className="text-3xl font-black mb-6 tracking-tight">{title}</h3>
        
        <p className="text-white/50 leading-relaxed mb-8">
          {description}
        </p>

        {isLocked && !showLoginPrompt && remaining > 0 && (
          <div className="mb-8">
             <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                <span>Unlock Progress</span>
                <span>{remaining.toLocaleString()} req.</span>
             </div>
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-yellow-500/50"
                />
             </div>
          </div>
        )}

        <ul className="space-y-4 mb-10">
          {stats.map((s, i) => (
             <li key={i} className="flex items-center gap-3 text-sm font-medium text-white/70">
                <div className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-white/10' : 'bg-white/20'}`} />
                {s}
             </li>
          ))}
        </ul>
      </div>

      <button
        onClick={isLocked ? undefined : onClick}
        disabled={isLocked}
        className={`group/btn w-full py-6 flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-sm transition-all rounded-b-[36px] active:scale-[0.98] ${
          showLoginPrompt
          ? 'bg-white/5 text-white/20 cursor-not-allowed'
          : isLocked 
            ? 'bg-white/5 text-white/20 cursor-not-allowed'
            : mode === 'easy' ? 'bg-green-500 hover:bg-green-400 text-black cursor-pointer' :
              mode === 'moderate' ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer' :
              'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.3)] cursor-pointer'
        }`}
      >
        {showLoginPrompt ? (
          <>Sign In Required</>
        ) : isLocked ? (
          <>Rank Locked</>
        ) : (
          <>
            <Play size={18} className="transition-transform group-hover/btn:scale-110 group-hover/btn:translate-x-0.5" />
            Start Mission
          </>
        )}
      </button>
    </motion.div>
  );
};

export default LandingPage;
