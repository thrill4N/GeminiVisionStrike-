/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, User as UserIcon, ChevronLeft, Target, ShieldCheck, Flame, Loader2 } from 'lucide-react';
import { ScoreService, HighScore, ViewState, UserProfile } from '../services/ScoreService';

interface DashboardProps {
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onBack }) => {
  const [scores, setScores] = useState<HighScore[]>([]);
  const [pb, setPb] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(ScoreService.getLocalProfile());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const globalScores = await ScoreService.getLeaderboard();
      setScores(globalScores);
      setPb(profile.totalPoints);
      setLoading(false);
    };
    fetchData();
  }, [profile.totalPoints]);

  return (
    <div className="min-h-screen bg-[#0a0502] text-white p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} /> Back to Menu
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => {
            localStorage.removeItem('gemine_tutorial_v1');
            window.location.reload();
          }}
          className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Target size={14} /> Tactical Briefing
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-4">
          <Trophy className="text-yellow-500" /> Global Hall of Fame
        </h1>
        <p className="text-white/40 mb-12">Tracking the most strategic shots across dimensions.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Stats Cards */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <div className="bg-yellow-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-yellow-500">
              <Trophy size={24} />
            </div>
            <div className="text-sm text-white/40 uppercase tracking-wider font-bold mb-1">Lifetime Score</div>
            <div className="text-3xl font-bold">{pb.toLocaleString()}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <div className="bg-blue-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-blue-500">
              <Clock size={24} />
            </div>
            <div className="text-sm text-white/40 uppercase tracking-wider font-bold mb-1">Profile Credits</div>
            <div className="text-3xl font-bold">{profile.coins.toLocaleString()}</div>
          </div>
          <div className="bg-purple-500/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <div className="bg-purple-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-purple-500">
              <UserIcon size={24} />
            </div>
            <div className="text-sm text-white/40 uppercase tracking-wider font-bold mb-1">Status</div>
            <div className="text-3xl font-bold">{pb > 50000 ? 'Ace' : 'Rookie'}</div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] overflow-hidden">
          <div className="p-8 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-xl font-bold">Top Missions</h2>
            {loading && <Loader2 className="animate-spin text-blue-500" size={20} />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-widest border-b border-white/5">
                  <th className="px-8 py-4 font-normal">Rank</th>
                  <th className="px-8 py-4 font-normal">Pilot</th>
                  <th className="px-8 py-4 font-normal">Mode</th>
                  <th className="px-8 py-4 font-normal">Date</th>
                  <th className="px-8 py-4 font-normal text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {!loading && scores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-white/20">
                      No missions logged yet. Ready for departure?
                    </td>
                  </tr>
                ) : (
                  scores.map((score, idx) => (
                    <motion.tr
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={score.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-8 py-6 font-mono text-white/40">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="px-8 py-6 font-medium">{score.name}</td>
                      <td className="px-8 py-6 uppercase text-[10px] tracking-tighter">
                        <span className={`px-2 py-1 rounded-full ${
                          score.mode === 'easy' ? 'bg-green-500/20 text-green-400' :
                          score.mode === 'moderate' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {score.mode}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-sm text-white/40">{score.date}</td>
                      <td className="px-8 py-6 text-right font-bold text-xl font-mono">{score.score.toLocaleString()}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
