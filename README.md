# Gemini Vision Strike: AI-Powered Tactical Slingshot

A sophisticated, full-stack web application that demonstrates the convergence of **Computer Vision**, **Generative AI**, and **Real-time Game Engineering**. This project was designed to showcase proficiency in integrating complex AI models into a performant, interactive user experience.

## 🚀 Vision & Engineering Goals

As an aspiring AI Engineer, I built this project to explore three core technical challenges:
1.  **Vision-Language Model (VLM) Integration**: Leveraging Gemini 1.5 Flash to perform real-time spatial analysis of dynamic game states via vision-prompting.
2.  **Human-Computer Interaction (HCI)**: Implementing low-latency hand tracking using MediaPipe to create a "natural" input system that bypasses traditional mouse/touch controls.
3.  **Real-time Logic vs. AI Latency**: Designing a system that balances local state management (physics, collisions) with asynchronous AI "strategic co-piloting."

## 🛠️ Deep Technical Stack

-   **Frontend Architecture**: React 19 (Hooks, Context, Refs) with a heavy emphasis on **DOM-less rendering** (HTML5 Canvas) for the game engine.
-   **Computer Vision**: `MediaPipe Hands` for 21-point skeletal landmark detection. I implemented a custom "pinch-to-pull" gesture logic that translates 3D normalized coordinates into game-world force vectors.
-   **AI Strategy Engine**: A custom TypeScript service that interfaces with the **Google Gemini SDK**. Features include:
    *   **Vision Stitching**: Capturing canvas snapshots and metadata (available clusters, danger levels) to provide context-aware strategic hints.
    *   **Contextual Difficulty**: The AI's personality and precision shift based on difficulty levels (e.g., simulating "combat interference" on hard mode).
-   **Full-Stack Persistence**: **Firebase (Firestore/Auth)** for secure user profiles, global leaderboards, and persistent game state.
-   **Real-time Synthesis**: A custom **Web Audio API** engine that synthesizes SFX (Sine/Triangle oscillators) on-the-fly, reducing asset load times and allowing for dynamic pitch modulation.
-   **Fluid UI**: Built with **Tailwind CSS 4** and **Framer Motion**, utilizing a glassmorphic design system for a futuristic aesthetic.

## 🧠 Technical Highlights for Recruiters

### Spatial Analysis via Vision Prompting
Unlike traditional bots that read a simple array of data, the Gemini co-pilot in this app "sees" the game. Through a tailored prompt and canvas snapshots, the model performs **strategic prioritization**:
-   **Avalanche Detection**: Identifying high-anchor bubbles that, if popped, drop the most "orphaned" bubbles.
-   **Risk Assessment**: Dynamically shifting focus to the "Danger Line" when bubbles descend past critical thresholds.

### Optimized Physics & Collision
The game engine implements a custom **Hexagonal Grid System**. Bubble positioning and proximity detection use axial coordinate math to ensure perfect alignment and high-performance recursive "flood-fill" algorithms for matching.

### Design Patterns
-   **Service-Oriented Architecture**: Clean separation between game logic (`GeminiSlingshot.tsx`), data persistence (`ScoreService.ts`), and AI interactions (`geminiService.ts`).
-   **Ref-driven Game Loop**: Utilizing `requestAnimationFrame` and `useRef` to maintain 60FPS while keeping React state minimal for UI overlays.

## 🎮 How to Play

1. **Grant Camera Permissions**: Required for the hand-tracking vision system.
2. **The Pinch Gesture**: 
   - Hover your hand over the slingshot.
   - **Pinch** (index + thumb) to grab.
   - **Pull & Release** to fire.
3. **Analyze**: Use the AI Tactical Panel to get real-time recommendations.

## ⚙️ Local Development Setup

To run this project locally:

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Configuration**:
    - Copy the template: `cp .env.example .env`
4.  **Start Dev Server**:
    ```bash
    npm run dev
    ```

---
## 👤 The Developer: Nkululeko Khalishwayo

This project was conceived and engineered by **Nkululeko Khalishwayo**, an aspiring AI Engineer and full-stack developer.

- **Objective**: To demonstrate the practical implementation of VLMs (Vision-Language Models) in high-frequency, interactive environments.
- **Project Context**: Developed as a core submission for the **Google AI Studio Challenge**, focusing on the seamless integration of generative AI and traditional game engine architectures.

*Developed with precision to push the boundaries of AI-integrated web development.*

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for the full text.
