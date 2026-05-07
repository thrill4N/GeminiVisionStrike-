/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ScoreService.ts
 * 
 * Core business logic for handling user profiles, scoring, synchronization with Firebase,
 * and the in-game economy (skins and daily rewards).
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

export type GameMode = 'easy' | 'moderate' | 'hard';
export type ViewState = 'landing' | 'game' | 'dashboard';

export interface HighScore {
  id: string;
  name: string;
  score: number;
  mode: GameMode;
  date: string;
  userId?: string;
}

export interface UserProfile {
  alias: string;
  coins: number;
  totalPoints: number;
  uid?: string;
  ownedSkins?: string[];
  selectedSkin?: string;
  lastDailyClaim?: number; // timestamp
}

export interface Skin {
  id: string;
  name: string;
  description: string;
  cost: number;
  color: string;
  glowColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const SKINS: Skin[] = [
  { id: 'default', name: 'Original Strike', description: 'The standard tactical slingshot.', cost: 0, color: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.5)', rarity: 'common' },
  { id: 'neon', name: 'Neon Pulse', description: 'Electric vibrations for high-speed action.', cost: 50, color: '#ec4899', glowColor: 'rgba(236, 72, 153, 0.5)', rarity: 'rare' },
  { id: 'emerald', name: 'Emerald Edge', description: 'Sharp focus with a toxic glow.', cost: 100, color: '#10b981', glowColor: 'rgba(16, 185, 129, 0.5)', rarity: 'rare' },
  { id: 'hyperwave', name: 'Hyperwave', description: 'Classic synthwave aesthetics.', cost: 250, color: '#a855f7', glowColor: 'rgba(168, 85, 247, 0.5)', rarity: 'epic' },
  { id: 'void', name: 'Void Walker', description: 'Dark energy from the deep space.', cost: 500, color: '#6366f1', glowColor: 'rgba(99, 102, 241, 0.5)', rarity: 'legendary' },
  { id: 'gold', name: 'Golden Sight', description: 'Pure luxury for elite strikers.', cost: 1000, color: '#eab308', glowColor: 'rgba(234, 179, 8, 0.5)', rarity: 'legendary' },
];

export const USER_KEY = 'gemini_slingshot_user';

export const UNLOCK_THRESHOLDS: Record<GameMode, number> = {
  easy: 0,
  moderate: 500,
  hard: 1500
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class ScoreService {
  /**
   * Retrieves the user profile from local storage.
   * Provides default values if no profile exists.
   */
  static getLocalProfile(): UserProfile {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : { 
      alias: 'Pilot', 
      coins: 0, 
      totalPoints: 0, 
      ownedSkins: ['default'], 
      selectedSkin: 'default' 
    };
  }

  /**
   * Fetches a user profile from Firestore based on UID.
   * Maps Firestore data to the internal UserProfile interface.
   */
  static async getProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          alias: data.alias || 'Pilot',
          coins: data.coins || 0,
          totalPoints: data.totalScore || 0,
          uid: uid,
          ownedSkins: data.ownedSkins || ['default'],
          selectedSkin: data.selectedSkin || 'default',
          lastDailyClaim: data.lastDailyClaim
        };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  }

   /**
   * Synchronizes the local profile with Firestore.
   * Prioritizes Firestore as the source of truth if a user is authenticated.
   */
  static async syncProfile(profile: UserProfile) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return;
    }

    const docRef = doc(db, 'users', uid);
    try {
      await setDoc(docRef, {
        alias: profile.alias,
        coins: profile.coins,
        totalScore: profile.totalPoints,
        ownedSkins: profile.ownedSkins || ['default'],
        selectedSkin: profile.selectedSkin || 'default',
        lastDailyClaim: profile.lastDailyClaim || 0,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  }

  /**
   * Claims the daily 50-coin combat reward if the 24-hour cycle has reset.
   * Syncs with local storage and Firebase (if authenticated).
   */
  static async claimDailyReward(): Promise<number | null> {
    const profile = this.getLocalProfile();
    const uid = auth.currentUser?.uid;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!profile.lastDailyClaim || now - profile.lastDailyClaim >= oneDay) {
      const reward = 50; 
      profile.coins += reward;
      profile.lastDailyClaim = now;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));

      if (uid) {
        const docRef = doc(db, 'users', uid);
        try {
          await updateDoc(docRef, {
            coins: increment(reward),
            lastDailyClaim: now,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      }
      return reward;
    }
    return null;
  }

  /**
   * Exchanges Earned Coins for New Slingshot Skins.
   * Validates balance and persists the new asset to the armory.
   */
  static async buySkin(skinId: string): Promise<boolean> {
    const profile = this.getLocalProfile();
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin) return false;

    if (!profile.ownedSkins) profile.ownedSkins = ['default'];
    if (profile.ownedSkins.includes(skinId)) return true;

    if (profile.coins >= skin.cost) {
      profile.coins -= skin.cost;
      profile.ownedSkins.push(skinId);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));

      const uid = auth.currentUser?.uid;
      if (uid) {
        const docRef = doc(db, 'users', uid);
        try {
          await updateDoc(docRef, {
            coins: increment(-skin.cost),
            ownedSkins: profile.ownedSkins,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Activates a purchased skin for the current user.
   * Persists the selection to both local storage and cloud.
   */
  static async selectSkin(skinId: string): Promise<void> {
    const profile = this.getLocalProfile();
    if (profile.ownedSkins?.includes(skinId)) {
      profile.selectedSkin = skinId;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));

      const uid = auth.currentUser?.uid;
      if (uid) {
        const docRef = doc(db, 'users', uid);
        try {
          await updateDoc(docRef, {
            selectedSkin: skinId,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      }
    }
  }

  /**
   * Updates points and coins after a combat session.
   * Triggers background sync if network is available.
   */
  static async updateScoreAndCoins(points: number, coinsEarned: number) {
    const uid = auth.currentUser?.uid;
    const profile = this.getLocalProfile();
    profile.totalPoints += points;
    profile.coins += coinsEarned;
    localStorage.setItem(USER_KEY, JSON.stringify(profile));

    if (uid) {
      const docRef = doc(db, 'users', uid);
      try {
        await updateDoc(docRef, {
          totalScore: increment(points),
          coins: increment(coinsEarned),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  }

  /**
   * Persists a game result to the global leaderboard.
   * Includes metadata like game mode and final level reached.
   */
  static async saveGameResult(score: number, mode: GameMode, level: number) {
    const profile = this.getLocalProfile();
    const uid = auth.currentUser?.uid;
    const alias = profile.alias || 'Pilot';

    if (uid) {
      const scoreRef = doc(collection(db, 'leaderboard'));
      try {
        await setDoc(scoreRef, {
          userId: uid,
          alias: alias,
          score: score,
          mode: mode,
          level: level,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'leaderboard');
      }
    }
  }

  /**
   * Retrieves the top 10 high scores from the leaderboard.
   * Can be filtered by game mode (Easy, Moderate, Hard).
   */
  static async getLeaderboard(mode?: GameMode): Promise<HighScore[]> {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('score', 'desc'),
      limit(10)
    );
    
    try {
      const querySnapshot = await getDocs(q);
      const scores: HighScore[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!mode || data.mode === mode) {
          scores.push({
            id: doc.id,
            name: data.alias,
            score: data.score,
            mode: data.mode,
            date: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toLocaleDateString() : 'Recent'
          });
        }
      });
      return scores;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'leaderboard');
      return [];
    }
  }

  static async spendCoins(amount: number): Promise<boolean> {
    const profile = this.getLocalProfile();
    const uid = auth.currentUser?.uid;

    if (profile.coins >= amount) {
      profile.coins -= amount;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));

      if (uid) {
        const docRef = doc(db, 'users', uid);
        try {
          await updateDoc(docRef, {
            coins: increment(-amount),
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      }
      return true;
    }
    return false;
  }
}
