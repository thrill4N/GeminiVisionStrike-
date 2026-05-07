import React from 'react';
import { motion } from 'framer-motion';
import { Shield, X, Lock, Eye, FileText, Database } from 'lucide-react';

interface PrivacyPolicyProps {
  onClose: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#0c0c14] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Privacy Policy</h2>
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Version 1.0.0 • Last Updated: May 2026</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Eye size={18} />
              <h3 className="font-bold uppercase tracking-wider text-sm">Data Overview</h3>
            </div>
            <p className="text-white/60 leading-relaxed">
              Gemini Vision Strike is designed with a "Privacy First" architecture. We only collect the minimum data necessary to provide game functionality, leaderboards, and AI-driven strategic analysis.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2 text-blue-400">
              <Database size={18} />
              <h3 className="font-bold uppercase tracking-wider text-sm">What We Collect</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Lock size={14} className="text-blue-400" /> Authentication
                </h4>
                <p className="text-xs text-white/50 leading-relaxed">
                  We use Google Authentication. We only store your public UID and email to associate your scores and profile across devices.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <FileText size={14} className="text-blue-400" /> Gameplay Data
                </h4>
                <p className="text-xs text-white/50 leading-relaxed">
                  High scores, coin balances, and difficulty statistics are stored in Firestore to enable the global leaderboard.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Shield size={18} />
              <h3 className="font-bold uppercase tracking-wider text-sm">AI & Vision Analysis</h3>
            </div>
            <p className="text-white/60 leading-relaxed">
              The AI Tactical Engine uses temporary snapshots of the game canvas to provide strategic hints. 
              <span className="block mt-2 font-semibold text-white/80 italic">important: Your webcam feed is processed locally on your device via MediaPipe. We never stream your actual camera video to our servers. Only static game-board frames are analyzed by the AI.</span>
            </p>
          </section>

          <section className="space-y-4 border-t border-white/5 pt-8">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Your Rights</h3>
            <p className="text-white/50 text-xs leading-relaxed">
              Under GDPR and CCPA, you have the right to request deletion of your data. Since your scores are tied to your Google UID, you can contact the developer to request a complete wipe of your profile from the Firestore database.
            </p>
          </section>

          <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center">
            <p className="text-blue-400/80 text-sm font-medium">
              Questions? Reach out to the Architect:<br />
              <span className="text-white font-bold">Nkululeko Khalishwayo</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PrivacyPolicy;
