const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // NOTE: APP_VERSION, FEEDBACK_EMAIL, FOLLOW_URL, DONATE_URL, and TIMING
    // are now loaded from data/constants.js

    const DEBUG_LOG = typeof localStorage !== 'undefined' && localStorage.getItem('ps_debug') === 'true';
    const debugLog = (tag, payload) => {
      if (!DEBUG_LOG) return;
      if (payload !== undefined) {
        console.log(`[ps-debug] ${tag}`, payload);
      } else {
        console.log(`[ps-debug] ${tag}`);
      }
    };

    const SETTINGS_DEFAULTS = {
      insightsEnabled: true,
      smartSuggestionsEnabled: true,
      darkMode: false,
      darkAccent: 'purple',
      showAllExercises: false,
      pinnedExercises: [],
      workoutViewMode: 'all',
      suggestedWorkoutCollapsed: true,
      useDemoData: false,
      lockedInMode: false
    };

    // ========== PWA SETUP ==========
    // Confirm manifest + icon links (guarded for templates that omit them).
    const manifestLink = document.getElementById('manifest-placeholder');
    if (manifestLink) manifestLink.setAttribute('href', 'manifest.json');
    const iconLink = document.getElementById('app-icon');
    const appleTouchLink = document.getElementById('apple-touch-icon');
    const APP_ICON_SVG = `
      <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#2b1055;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7597de;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#e0e0e0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#9e9e9e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#spaceGrad)" />
        <circle cx="200" cy="200" r="10" fill="white" opacity="0.8"/>
        <circle cx="800" cy="150" r="6" fill="white" opacity="0.6"/>
        <circle cx="900" cy="800" r="8" fill="white" opacity="0.7"/>
        <circle cx="100" cy="900" r="5" fill="white" opacity="0.5"/>
        <circle cx="500" cy="100" r="4" fill="white" opacity="0.4"/>
        <circle cx="512" cy="512" r="280" fill="#7245d8" />
        <path d="M 232 512 C 232 400, 792 400, 792 512" stroke="#4cc9f0" stroke-width="40" fill="none" opacity="0.6" stroke-linecap="round"/>
        <rect x="312" y="472" width="400" height="80" rx="10" fill="#b0bec5" />
        <rect x="232" y="412" width="60" height="200" rx="15" fill="url(#metalGrad)" />
        <rect x="192" y="432" width="40" height="160" rx="10" fill="#78909c" />
        <rect x="732" y="412" width="60" height="200" rx="15" fill="url(#metalGrad)" />
        <rect x="792" y="432" width="40" height="160" rx="10" fill="#78909c" />
      </svg>
    `.trim();
    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(APP_ICON_SVG)}`;
    if (iconLink) iconLink.setAttribute('href', svgDataUri);
    const ensureAppleTouchIcon = () => {
      if (!appleTouchLink) return;
      const size = 180;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        appleTouchLink.setAttribute('href', canvas.toDataURL('image/png'));
      };
      const encoded = btoa(unescape(encodeURIComponent(APP_ICON_SVG)));
      img.src = `data:image/svg+xml;base64,${encoded}`;
    };
    ensureAppleTouchIcon();

    // Register service worker
    // Register service worker only on supported origins (not file://)
    const isSecureContextOk = location.protocol === 'https:' || location.hostname === 'localhost';
    if (isSecureContextOk && 'serviceWorker' in navigator) {
      const SW_CODE = `
        const CACHE = 'ps-v2';
        self.addEventListener('install', e => {
          e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', 'https://cdn.tailwindcss.com'])));
        });
        self.addEventListener('fetch', e => {
          e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
        });
      `;
      const swBlob = new Blob([SW_CODE], { type: 'application/javascript' });
      const swURL = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swURL).catch(() => {});
    }

    // PWA Install Prompt Component
    const InstallPrompt = () => {
      const [show, setShow] = useState(false);
      const [prompt, setPrompt] = useState(null);
      const [showIosTip, setShowIosTip] = useState(false);

      useEffect(() => {
        const ua = navigator.userAgent || '';
        const isAndroid = /android/i.test(ua);
        const isIOS = /iphone|ipad|ipod/i.test(ua);
        const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|edgios|chrome/i.test(ua);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        const handler = (e) => {
          if (!isAndroid) return;
          e.preventDefault();
          setPrompt(e);
          setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        if (isIOS && isSafari && !isStandalone) {
          setShowIosTip(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
      }, []);

      const install = async () => {
        if (!prompt) return;
        prompt.prompt();
        await prompt.userChoice;
        setShow(false);
      };

      if (!show && !showIosTip) return null;

      return ReactDOM.createPortal(
        <>
          {show && (
            <div className="install-prompt">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📱</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Install on Android</div>
                  <div className="text-xs opacity-80">Add to home screen</div>
                </div>
                <button onClick={install} className="bg-white/20 px-4 py-2 rounded-lg font-bold text-sm">
                  Install
                </button>
                <button onClick={() => setShow(false)} className="text-white/60 text-xl px-2">×</button>
              </div>
            </div>
          )}
          {showIosTip && (
            <div className="ios-install-tip">
              <div className="text-xs font-semibold text-gray-600">Tip: Add Planet Strength to your Home Screen from Share.</div>
              <button onClick={() => setShowIosTip(false)} className="text-gray-400 text-lg px-2">×</button>
            </div>
          )}
        </>,
        document.getElementById('install-prompt')
      );
    };


    // ========== ERROR BOUNDARY ==========
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }

      componentDidCatch(error, errorInfo) {
        console.error('Planet Strength Error:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full text-center space-y-4">
                <div className="text-4xl">😅</div>
                <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-gray-600">
                  Don't worry, your workout data is safe. Try reloading the app.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl active:scale-95 transition-transform"
                >
                  Reload App
                </button>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-transform"
                >
                  Try Again
                </button>
              </div>
            </div>
          );
        }

        return this.props.children;
      }
    }

    // ========== ICONS ==========
    // Icon component is now loaded from components/Icon.jsx

    // ========== STORAGE ==========
    // storage helper is now loaded from hooks/storage.js

    const getDailyQuote = (pool, key) => {
      if (!pool.length) return null;
      const dayKey = toDayKey(new Date());
      const storageKey = `ps_quote_${key}_${dayKey}`;
      const storedIndex = storage.get(storageKey, null);
      if (storedIndex !== null && pool[storedIndex]) return pool[storedIndex];
      const idx = Math.floor(Math.random() * pool.length);
      storage.set(storageKey, idx);
      return pool[idx];
    };

    const getRandomQuote = (pool) => {
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const normalizeMuscleGroup = (raw) => {
      if (!raw) return 'other';
      const type = typeof raw === 'string' ? null : raw?.type;
      if (type === 'cardio') return 'cardio';
      const value = typeof raw === 'string'
        ? raw.toLowerCase()
        : `${raw?.target || raw?.muscles || raw?.muscleGroup || raw?.name || ''}`.toLowerCase();
      if (!value) return 'other';
      if (value.includes('full body') || value.includes('fullbody')) return 'fullbody';
      if (value.includes('chest') || value.includes('pec')) return 'chest';
      if (value.includes('back') || value.includes('lat') || value.includes('trap')) return 'back';
      if (value.includes('leg') || value.includes('quad') || value.includes('hamstring') || value.includes('glute') || value.includes('calf') || value.includes('thigh')) return 'legs';
      if (value.includes('shoulder') || value.includes('delt')) return 'shoulders';
      if (value.includes('bicep') || value.includes('tricep') || value.includes('arm') || value.includes('forearm') || value.includes('brach')) return 'arms';
      if (value.includes('core') || value.includes('ab') || value.includes('oblique')) return 'core';
      return 'other';
    };

    const resolveMuscleGroup = (raw) => {
      const normalized = normalizeMuscleGroup(raw);
      switch (normalized) {
        case 'chest':
          return 'Chest';
        case 'back':
          return 'Back';
        case 'legs':
          return 'Legs';
        case 'core':
          return 'Core';
        case 'arms':
          return 'Arms';
        case 'shoulders':
          return 'Shoulders';
        case 'cardio':
          return 'Cardio';
        case 'fullbody':
          return 'Full Body';
        default:
          return 'Other';
      }
    };

    const buildMuscleDistribution = (history = {}, rangeDays = 30) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Math.max(rangeDays - 1, 0));
      cutoff.setHours(0, 0, 0, 0);
      const counts = {
        chest: 0,
        back: 0,
        legs: 0,
        core: 0,
        arms: 0,
        shoulders: 0
      };

      Object.entries(history || {}).forEach(([equipId, arr]) => {
        const eq = EQUIPMENT_DB[equipId];
        safeArray(arr).forEach(session => {
          if (!session?.date) return;
          const time = new Date(session.date).getTime();
          if (!Number.isFinite(time) || time < cutoff.getTime()) return;
          const group = normalizeMuscleGroup(session.muscleGroup || eq);
          if (group && counts[group] !== undefined) counts[group] += 1;
        });
      });

      return counts;
    };

    const MUSCLE_BADGE_CONFIG = {
      chest: {
        tint: 'var(--tint-chest)',
        icon: <path d="M3 12h4l2 6 4-12 3 9h5" />
      },
      back: {
        tint: 'var(--tint-back)',
        icon: <path d="M12 3 4.5 6.5V12c0 4.5 3.3 8.6 7.5 9 4.2-.4 7.5-4.5 7.5-9V6.5L12 3Z" />
      },
      legs: {
        tint: 'var(--tint-legs)',
        icon: <path d="M6 4v8l4 4 4-4V4M10 16l-2 4M14 16l2 4" />
      },
      core: {
        tint: 'var(--tint-core)',
        icon: <path d="M5 7h14M5 12h14M5 17h14" />
      },
      arms: {
        tint: 'var(--tint-arms)',
        icon: <path d="M4 12h3l1-3h8l1 3h3M6 12v4M18 12v4" />
      },
      shoulders: {
        tint: 'var(--tint-shoulders)',
        icon: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M7 7l2 2M15 7l-2 2M7 17l2-2M15 17l-2-2" />
      },
      neutral: {
        tint: 'color-mix(in srgb, var(--muted) 35%, var(--surface))',
        icon: <path d="M4 12h16M12 4v16" />
      }
    };

    const renderMuscleBadge = (muscleGroup) => {
      const key = normalizeMuscleGroup(muscleGroup);
      const config = MUSCLE_BADGE_CONFIG[key] || MUSCLE_BADGE_CONFIG.neutral;
      return (
        <span className="muscle-badge" style={{ '--badge-tint': config.tint }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {config.icon}
          </svg>
        </span>
      );
    };

    const getLastWorkedDateForGroup = (muscleGroup, history = {}, exerciseMeta = {}) => {
      if (!muscleGroup) return null;
      const target = normalizeMuscleGroup(muscleGroup);
      let latest = null;
      Object.entries(exerciseMeta || {}).forEach(([id, meta]) => {
        if (!meta || meta.type === 'cardio' || meta.type === 'easterEgg') return;
        const group = normalizeMuscleGroup(meta);
        if (!group || group !== target) return;
        safeArray(history?.[id]).forEach(session => {
          if (!session?.date) return;
          const time = new Date(session.date).getTime();
          if (!Number.isFinite(time)) return;
          if (!latest || time > latest.getTime()) {
            latest = new Date(time);
          }
        });
      });
      return latest;
    };

    const formatLastWorkedLabel = (lastDate, now = new Date()) => {
      if (!lastDate) {
        return 'Not logged yet';
      }
      const msPerDay = 24 * 60 * 60 * 1000;
      const nowDate = now instanceof Date ? now : new Date(now);
      const diffDays = Math.floor((nowDate - lastDate) / msPerDay);
      if (diffDays <= 7) {
        const weekday = lastDate.toLocaleDateString(undefined, { weekday: 'short' });
        return `Last worked • ${weekday}`;
      }
      const dateStr = lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `Last worked • ${dateStr}`;
    };

    const getLastUsedDateForExercise = (exerciseId, history = {}, cardioHistory = {}) => {
      if (!exerciseId) return null;
      let latest = null;
      if (exerciseId.startsWith('cardio_')) {
        const cardioType = exerciseId.replace('cardio_', '');
        safeArray(cardioHistory?.[cardioType]).forEach(session => {
          if (!session?.date) return;
          const time = new Date(session.date).getTime();
          if (!Number.isFinite(time)) return;
          if (!latest || time > latest.getTime()) {
            latest = new Date(time);
          }
        });
      }
      safeArray(history?.[exerciseId]).forEach(session => {
        if (!session?.date) return;
        const time = new Date(session.date).getTime();
        if (!Number.isFinite(time)) return;
        if (!latest || time > latest.getTime()) {
          latest = new Date(time);
        }
      });
      return latest;
    };

    const formatDaysAgo = (lastDate, now = new Date()) => {
      if (!lastDate) return 'Not used yet';

      const msPerDay = 24 * 60 * 60 * 1000;
      const nowDate = now instanceof Date ? now : new Date(now);
      const diffDays = Math.floor((nowDate - lastDate) / msPerDay);

      if (diffDays < 1) return 'Today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays <= 30) return `${diffDays} days ago`;
      return 'Over a month ago';
    };

    const getLastWorkoutDate = (history = {}, cardioHistory = {}) => {
      const dates = [];
      Object.values(history || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (s?.date) dates.push(new Date(s.date));
        });
      });
      Object.values(cardioHistory || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (s?.date) dates.push(new Date(s.date));
        });
      });
      if (dates.length === 0) return null;
      return new Date(Math.max(...dates.map(d => d.getTime())));
    };

    const buildLastSessionSummary = (history, lastWorkoutLabel) => {
      if (!history || !lastWorkoutLabel) return null;
      const sessions = [];
      Object.entries(history || {}).forEach(([exerciseId, arr]) => {
        safeArray(arr).forEach(session => {
          if (!session?.date) return;
          sessions.push({ ...session, exerciseId });
        });
      });
      if (sessions.length === 0) return null;
      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastSessionDate = sessions[0]?.date;
      if (!lastSessionDate) return null;
      const lastSessionKey = toDayKey(new Date(lastSessionDate));
      const lastExercises = sessions.filter(session => toDayKey(new Date(session.date)) === lastSessionKey);
      const totalSets = lastExercises.reduce((sum, session) => sum + safeArray(session.sets).length, 0);
      const muscleCounts = {};
      lastExercises.forEach(session => {
        const eq = EQUIPMENT_DB[session.exerciseId];
        const key = resolveMuscleGroup(eq);
        muscleCounts[key] = (muscleCounts[key] || 0) + 1;
      });
      const primaryMuscle = Object.entries(muscleCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      const parts = [`Last session · ${lastWorkoutLabel}`];
      if (totalSets) parts.push(`${totalSets} sets`);
      if (primaryMuscle) parts.push(primaryMuscle);

      const detailParts = [];
      if (primaryMuscle) detailParts.push(primaryMuscle);
      if (totalSets) detailParts.push(`${totalSets} sets`);

      return {
        full: parts.join(' • '),
        short: lastWorkoutLabel,
        detail: detailParts.join(' • ')
      };
    };

    // ========== EXTRACTED DATA ==========
    // The following are now loaded from separate files in /data:
    // - data/constants.js: AVATARS, homeQuotes, postWorkoutQuotes, restDayQuotes, GYM_TYPES,
    //   EXPERIENCE_LEVELS, ACTIVITY_LEVELS, GOALS, DIFFICULTY_LEVELS,
    //   CARDIO_TYPES, motivationalQuotes, TIMING, THRESHOLDS, STORAGE_KEYS
    // - data/equipment.js: EQUIPMENT_DB
    // - data/workoutPlans.js: WORKOUT_PLANS, BIG_BASICS

    // ========== UTILITIES ==========
    const clampTo5 = (n) => Math.max(10, Math.round(n / 5) * 5);
    const safeArray = (value) => (Array.isArray(value) ? value : []);

    if (typeof WORKOUT_PLANS === 'object' && WORKOUT_PLANS !== null) {
      WORKOUT_PLANS.Push = {
        machines: ["chest_press", "shoulder_press", "pec_fly", "cable_tricep"],
        dumbbells: [],
        barbells: []
      };
      WORKOUT_PLANS.Pull = {
        machines: ["lat_pulldown", "seated_row", "cable_bicep"],
        dumbbells: ["db_row"],
        barbells: []
      };
      WORKOUT_PLANS.Legs = {
        machines: ["leg_press", "leg_extension", "leg_curl"],
        dumbbells: ["db_goblet_squat"],
        barbells: []
      };
      WORKOUT_PLANS.Core = {
        machines: ["ab_crunch", "back_extension", "cable_woodchop"],
        dumbbells: ["plank_bodyweight"],
        barbells: []
      };
      WORKOUT_PLANS["Full Body"] = {
        machines: ["chest_press", "lat_pulldown", "leg_press"],
        dumbbells: ["db_shoulder_press"],
        barbells: []
      };
    }

    // useDebounce hook is now loaded from hooks/useDebounce.js
    // usePersistedState hook is now loaded from hooks/usePersistedState.js

    const toDayKey = (date = new Date()) => {
      const y = date.getFullYear();
      const m = String(date.getMonth()+1).padStart(2,'0');
      const d = String(date.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    };

    // Storage keys are now loaded from data/constants.js

    const uniqueDayKeysFromHistory = (history, cardioHistory = {}, restDays = [], dayEntries = null) => {
      if (dayEntries && Object.keys(dayEntries).length > 0) {
        return Object.keys(dayEntries).sort();
      }

      const keys = new Set();
      // Add workout days
      Object.values(history || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (s?.date) keys.add(toDayKey(new Date(s.date)));
        });
      });
      // Add cardio days
      Object.values(cardioHistory || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (s?.date) keys.add(toDayKey(new Date(s.date)));
        });
      });
      // Add rest days
      (restDays || []).forEach(d => keys.add(d));
      return Array.from(keys).sort();
    };

    const computeStreak = (history, cardioHistory = {}, restDays = [], dayEntries = null) => {
      const days = uniqueDayKeysFromHistory(history, cardioHistory, restDays, dayEntries);
      if (days.length === 0) return { current: 0, best: 0, lastDayKey: null, hasToday: false };

      let best = 1, run = 1;
      for (let i=1;i<days.length;i++){
        const prev = new Date(days[i-1]);
        const cur = new Date(days[i]);
        const diff = (cur - prev) / 86400000;
        if (diff === 1) { run++; best = Math.max(best, run); }
        else run = 1;
      }

      const todayKey = toDayKey(new Date());
      let current = 1;
      let i = days.length - 1;
      let anchor = days[i];

      while (i > 0) {
        const a = new Date(days[i-1]);
        const b = new Date(days[i]);
        const diff = (b - a) / 86400000;
        if (diff === 1) current++;
        else break;
        i--;
      }

      return { current, best, lastDayKey: anchor, hasToday: anchor === todayKey };
    };

    const buildDayEntriesFromHistory = (history = {}, cardioHistory = {}, restDays = []) => {
      const entries = {};
      Object.values(history || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (!s?.date) return;
          const key = toDayKey(new Date(s.date));
          entries[key] = entries[key] || { type: 'workout', date: key, exercises: [] };
        });
      });
      Object.values(cardioHistory || {}).forEach(arr => {
        safeArray(arr).forEach(s => {
          if (!s?.date) return;
          const key = toDayKey(new Date(s.date));
          entries[key] = entries[key] || { type: 'workout', date: key, exercises: [] };
        });
      });
      (restDays || []).forEach(d => {
        entries[d] = entries[d] || { type: 'rest', date: d, exercises: [] };
      });
      return entries;
    };

    const createSeededRandom = (seed = 42) => {
      let value = seed % 2147483647;
      if (value <= 0) value += 2147483646;
      return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
      };
    };

    const generateDemoData = (days = 30) => {
      const rng = createSeededRandom(917202);
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1));
      const totalDays = Math.max(7, days);
      const workoutDayIndices = new Set();
      for (let weekStart = 0; weekStart < totalDays; weekStart += 7) {
        const available = [];
        for (let offset = 0; offset < 7; offset += 1) {
          if (weekStart + offset < totalDays) available.push(weekStart + offset);
        }
        const plannedWorkouts = Math.min(available.length, 3 + Math.floor(rng() * 3));
        const shuffled = [...available].sort(() => rng() - 0.5);
        shuffled.slice(0, plannedWorkouts).forEach(idx => workoutDayIndices.add(idx));
      }

      const equipmentByGroup = {};
      Object.entries(EQUIPMENT_DB).forEach(([id, eq]) => {
        if (!eq || eq.type === 'cardio' || eq.type === 'easterEgg') return;
        const group = resolveMuscleGroup(eq);
        if (group === 'Other') return;
        if (!equipmentByGroup[group]) equipmentByGroup[group] = [];
        equipmentByGroup[group].push(id);
      });

      const muscleGroups = Object.keys(equipmentByGroup);
      const pickFromGroup = (group, count) => {
        const pool = equipmentByGroup[group] || [];
        const picks = [];
        const copy = [...pool];
        while (copy.length > 0 && picks.length < count) {
          const idx = Math.floor(rng() * copy.length);
          picks.push(copy.splice(idx, 1)[0]);
        }
        return picks;
      };

      const buildSets = (eq) => {
        const base = eq?.type === 'machine' ? 35 : eq?.type === 'barbell' ? 65 : eq?.type === 'dumbbell' ? 15 : 20;
        const spread = eq?.type === 'barbell' ? 95 : 55;
        return Array.from({ length: 3 }, () => ({
          weight: Math.max(5, Math.round(base + rng() * spread)),
          reps: 6 + Math.floor(rng() * 7)
        }));
      };

      const history = {};
      const cardioHistory = {};
      const restDays = [];
      const sortedDays = Array.from(workoutDayIndices).sort((a, b) => a - b);
      sortedDays.forEach((dayIndex) => {
        const date = new Date(start);
        date.setDate(start.getDate() + dayIndex);
        const timeRoll = rng();
        if (timeRoll < 0.45) date.setHours(18 + Math.floor(rng() * 3), 10 + Math.floor(rng() * 40));
        else if (timeRoll < 0.75) date.setHours(6 + Math.floor(rng() * 3), 5 + Math.floor(rng() * 50));
        else date.setHours(12 + Math.floor(rng() * 3), 5 + Math.floor(rng() * 50));

        const focusRoll = rng();
        const focusGroup = focusRoll < 0.2 ? 'Legs'
          : focusRoll < 0.38 ? 'Back'
            : focusRoll < 0.56 ? 'Chest'
              : focusRoll < 0.72 ? 'Shoulders'
                : focusRoll < 0.86 ? 'Arms'
                  : 'Core';

        const exerciseCount = 3 + Math.floor(rng() * 3);
        const exerciseIds = new Set();
        pickFromGroup(focusGroup, Math.min(2, exerciseCount)).forEach(id => exerciseIds.add(id));
        while (exerciseIds.size < exerciseCount) {
          const group = muscleGroups[Math.floor(rng() * muscleGroups.length)];
          const picks = pickFromGroup(group, 1);
          if (picks.length > 0) exerciseIds.add(picks[0]);
          if (exerciseIds.size >= exerciseCount) break;
        }

        exerciseIds.forEach((exerciseId) => {
          const eq = EQUIPMENT_DB[exerciseId];
          const session = {
            date: date.toISOString(),
            sets: buildSets(eq),
            notes: rng() < 0.18 ? 'Felt steady today.' : undefined
          };
          history[exerciseId] = [...(history[exerciseId] || []), session];
        });

        if (rng() < 0.32) {
          const cardioType = rng() < 0.7 ? 'running' : 'swimming';
          const duration = 18 + Math.floor(rng() * 28);
          const distance = cardioType === 'running' ? Number((1.2 + rng() * 3.4).toFixed(1)) : Math.round(500 + rng() * 1200);
          const intensity = rng() < 0.4 ? 'easy' : rng() < 0.75 ? 'moderate' : 'strong';
          const session = {
            date: date.toISOString(),
            duration,
            distance,
            intensity
          };
          cardioHistory[cardioType] = [...(cardioHistory[cardioType] || []), session];
        }
      });

      const dayEntries = buildDayEntriesFromHistory(history, cardioHistory, restDays);
      return { history, cardioHistory, restDays, dayEntries };
    };

    const normalizeHistory = (obj) => {
      const safe = {};
      if (!obj || typeof obj !== 'object') return safe;
      Object.entries(obj).forEach(([key, value]) => {
        if (!Array.isArray(value)) {
          safe[key] = [];
          return;
        }
        const entries = value
          .filter(item => item && typeof item === 'object' && !Array.isArray(item))
          .filter(item => item.date)
          .map(item => {
            const sets = Array.isArray(item.sets)
              ? item.sets
                .filter(set => set && typeof set === 'object')
                .map(set => ({
                  reps: Number(set.reps),
                  weight: Number(set.weight)
                }))
                .filter(set => Number.isFinite(set.reps) && Number.isFinite(set.weight))
              : [];
            return { ...item, sets };
          });
        safe[key] = entries;
      });
      return safe;
    };

    const normalizeCardioHistory = (obj) => {
      const safe = {};
      if (!obj || typeof obj !== 'object') return safe;
      Object.entries(obj).forEach(([key, value]) => {
        if (!Array.isArray(value)) {
          safe[key] = [];
          return;
        }
        const entries = value
          .filter(item => item && typeof item === 'object' && !Array.isArray(item))
          .filter(item => item.date)
          .map(item => ({
            ...item,
            duration: Number(item.duration),
            distance: item.distance !== undefined && item.distance !== null ? Number(item.distance) : undefined,
            intensity: item.intensity || item.effort || null
          }))
          .filter(item => Number.isFinite(item.duration) && item.duration > 0);
        safe[key] = entries;
      });
      return safe;
    };

    const normalizeDayEntries = (obj, history, cardioHistory, restDays) => {
      if (!obj || typeof obj !== 'object') {
        return buildDayEntriesFromHistory(history, cardioHistory, restDays);
      }
      const entries = {};
      Object.entries(obj).forEach(([key, value]) => {
        if (!value || typeof value !== 'object') return;
        entries[key] = {
          type: value.type || 'workout',
          date: value.date || key,
          exercises: Array.isArray(value.exercises) ? value.exercises.filter(Boolean) : []
        };
      });
      return Object.keys(entries).length > 0 ? entries : buildDayEntriesFromHistory(history, cardioHistory, restDays);
    };

    let demoDataCache = null;
    const getEffectiveData = (realData, demoEnabled) => {
      const base = realData || {};
      const source = demoEnabled
        ? (demoDataCache || (demoDataCache = generateDemoData(30)))
        : {
          history: base.history,
          cardioHistory: base.cardioHistory,
          restDays: base.restDays,
          dayEntries: base.dayEntries
        };
      const history = normalizeHistory(source.history);
      const cardioHistory = normalizeCardioHistory(source.cardioHistory);
      const restDays = Array.isArray(source.restDays) ? source.restDays.filter(Boolean) : [];
      const dayEntries = normalizeDayEntries(source.dayEntries, history, cardioHistory, restDays);
      return { history, cardioHistory, restDays, dayEntries };
    };

    const buildPatternsFromHistory = (history = {}, cardioHistory = {}) => {
      const sessions = [];
      const seen = new Set();
      Object.entries(history || {}).forEach(([equipId, arr]) => {
        safeArray(arr).forEach(session => {
          if (!session?.date) return;
          const key = `${session.date}-${equipId}-${session.type || 'strength'}`;
          if (seen.has(key)) return;
          seen.add(key);
          sessions.push({ ...session, equipId, type: session.type || (EQUIPMENT_DB[equipId]?.type === 'cardio' ? 'cardio' : 'strength') });
        });
      });
      Object.entries(cardioHistory || {}).forEach(([cardioType, arr]) => {
        safeArray(arr).forEach(session => {
          if (!session?.date) return;
          const key = `${session.date}-${cardioType}-cardio`;
          if (seen.has(key)) return;
          seen.add(key);
          sessions.push({ ...session, equipId: `cardio_${cardioType}`, type: 'cardio' });
        });
      });

      if (sessions.length < 4) return [];

      const totalWorkoutDays = new Set(sessions.map(s => toDayKey(new Date(s.date)))).size;
      const firstDate = sessions.reduce((min, s) => Math.min(min, new Date(s.date).getTime()), Date.now());
      const lastDate = sessions.reduce((max, s) => Math.max(max, new Date(s.date).getTime()), 0);
      const weeksSpan = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7)) || 1);
      const strengthSessions = sessions.filter(s => s.type !== 'cardio');
      const cardioSessions = sessions.filter(s => s.type === 'cardio');

      const patterns = [];
      const addPattern = (pattern) => {
        if (!pattern?.title) return;
        if (patterns.find(item => item.title === pattern.title)) return;
        patterns.push(pattern);
      };

      const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      sessions.forEach(s => {
        const hour = new Date(s.date).getHours();
        if (hour >= 5 && hour < 11) timeBuckets.morning += 1;
        else if (hour >= 11 && hour < 17) timeBuckets.afternoon += 1;
        else if (hour >= 17 && hour < 22) timeBuckets.evening += 1;
        else timeBuckets.night += 1;
      });
      const totalSessions = sessions.length || 1;
      const topBucket = Object.entries(timeBuckets).sort((a, b) => b[1] - a[1])[0];
      if (topBucket && topBucket[1] / totalSessions >= 0.45) {
        const label = topBucket[0] === 'morning' ? 'morning' : topBucket[0] === 'afternoon' ? 'midday' : topBucket[0] === 'evening' ? 'evening' : 'late night';
        const emoji = topBucket[0] === 'morning' ? '🌤️' : topBucket[0] === 'afternoon' ? '🕛' : topBucket[0] === 'evening' ? '🌙' : '✨';
        addPattern({ title: `You usually train in the ${label}.`, subtext: 'Your logs cluster there most often.', icon: emoji });
      } else if (timeBuckets.morning > 0 && timeBuckets.evening > 0) {
        addPattern({ title: 'You bounce between morning and evening sessions.', subtext: 'Your schedule stays flexible.', icon: '🧭' });
      }

      if (strengthSessions.length > 0) {
        const groupCounts = {};
        strengthSessions.forEach(s => {
          const eq = EQUIPMENT_DB[s.equipId];
          if (!eq) return;
          const group = resolveMuscleGroup(eq);
          groupCounts[group] = (groupCounts[group] || 0) + 1;
        });
        const sortedGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
        const topGroup = sortedGroups[0]?.[0];
        const upperGroups = ['Chest', 'Back', 'Shoulders', 'Arms'];
        if (topGroup) {
          const label = upperGroups.includes(topGroup) ? 'Upper body' : topGroup;
          addPattern({ title: `${label} shows up most often.`, subtext: 'That focus keeps repeating.', icon: '🏋️' });
        }

        const legsCount = groupCounts.Legs || 0;
        if (legsCount > 0) {
          const legsPerWeek = legsCount / weeksSpan;
          if (legsPerWeek >= 0.7 && legsPerWeek <= 1.4) {
            addPattern({ title: 'Legs happen about once a week.', subtext: 'A steady lower-body rhythm.', icon: '🦵' });
          } else if (legsPerWeek > 1.4) {
            addPattern({ title: 'Legs show up most weeks.', subtext: 'Lower body stays in the mix.', icon: '🦵' });
          }
        }

        const typeCounts = { machine: 0, free: 0 };
        strengthSessions.forEach(s => {
          const eq = EQUIPMENT_DB[s.equipId];
          if (!eq) return;
          if (eq.type === 'machine') typeCounts.machine += 1;
          if (['dumbbell', 'barbell', 'kettlebell', 'bodyweight'].includes(eq.type)) typeCounts.free += 1;
        });
        const typeTotal = typeCounts.machine + typeCounts.free;
        if (typeTotal > 0) {
          const machinePct = typeCounts.machine / typeTotal;
          const freePct = typeCounts.free / typeTotal;
          if (machinePct >= 0.3 && freePct >= 0.3) {
            addPattern({ title: 'You mix machines and free weights.', subtext: 'Best of both worlds.', icon: '⚙️' });
          } else if (machinePct > 0.7) {
            addPattern({ title: 'Machines are a go-to for you.', subtext: 'Steady, consistent loading.', icon: '🛠️' });
          } else if (freePct > 0.7) {
            addPattern({ title: 'Free weights lead the way.', subtext: 'Lots of variety in your lifts.', icon: '🏋️‍♀️' });
          }
        }

        const coreDays = new Set();
        const mixedCoreDays = new Set();
        Object.entries(history || {}).forEach(([equipId, arr]) => {
          const eq = EQUIPMENT_DB[equipId];
          if (!eq) return;
          const group = resolveMuscleGroup(eq);
          safeArray(arr).forEach(s => {
            if (!s?.date) return;
            const key = toDayKey(new Date(s.date));
            if (group === 'Core') coreDays.add(key);
          });
        });
        Object.entries(history || {}).forEach(([equipId, arr]) => {
          const eq = EQUIPMENT_DB[equipId];
          if (!eq) return;
          const group = resolveMuscleGroup(eq);
          safeArray(arr).forEach(s => {
            if (!s?.date) return;
            const key = toDayKey(new Date(s.date));
            if (group !== 'Core' && coreDays.has(key)) mixedCoreDays.add(key);
          });
        });
        if (mixedCoreDays.size > 0 && totalWorkoutDays > 0 && mixedCoreDays.size / totalWorkoutDays >= 0.35) {
          addPattern({ title: 'You often include core work alongside your main lifts.', subtext: 'A balanced finish.', icon: '🧘' });
        }

        const uniqueGroups = Object.keys(groupCounts).filter(group => groupCounts[group] > 0);
        if (uniqueGroups.length >= 4) {
          addPattern({ title: 'You rotate through multiple muscle groups.', subtext: 'Your plan stays well-rounded.', icon: '🧩' });
        }
      }

      if (cardioSessions.length > 0) {
        const cardioPerWeek = cardioSessions.length / weeksSpan;
        if (cardioPerWeek >= 1) {
          addPattern({ title: 'Cardio shows up most weeks.', subtext: 'A steady dose of conditioning.', icon: '🏃' });
        } else {
          addPattern({ title: 'You sprinkle in cardio sessions.', subtext: 'Just enough for balance.', icon: '🏃' });
        }
      }

      const durations = [];
      cardioSessions.forEach(session => {
        if (Number.isFinite(session.duration) && session.duration > 0) durations.push(session.duration);
        if (Array.isArray(session.entries) && session.entries.length > 0) {
          session.entries.forEach(entry => {
            if (Number.isFinite(entry.durationMin) && entry.durationMin > 0) durations.push(entry.durationMin);
          });
        }
      });
      if (durations.length >= 3) {
        const sorted = [...durations].sort((a, b) => a - b);
        const mid = sorted[Math.floor(sorted.length / 2)];
        const rounded = Math.round(mid / 5) * 5;
        addPattern({ title: `Your most common workout length is about ${rounded} minutes.`, subtext: 'A steady, repeatable window.', icon: '⏱️' });
      }

      if (totalWorkoutDays > 0) {
        const perWeek = totalWorkoutDays / weeksSpan;
        if (perWeek >= 4) {
          addPattern({ title: 'You log workouts most weeks.', subtext: 'Nice, steady momentum.', icon: '📅' });
        } else if (perWeek >= 2) {
          addPattern({ title: 'You usually get in a couple sessions each week.', subtext: 'Solid rhythm without overthinking.', icon: '📆' });
        }
      }

      const weekdayCount = sessions.filter(s => {
        const day = new Date(s.date).getDay();
        return day >= 1 && day <= 5;
      }).length;
      const weekendCount = sessions.length - weekdayCount;
      if (weekdayCount / totalSessions >= 0.7) {
        addPattern({ title: 'Weekdays are your training anchor.', subtext: 'You keep it consistent through the week.', icon: '🗓️' });
      } else if (weekendCount / totalSessions >= 0.5) {
        addPattern({ title: 'Weekends are your training anchor.', subtext: 'You make the most of open time.', icon: '🎯' });
      }

      return patterns.slice(0, 8);
    };

    const deriveRecentExercises = (history = {}, limit = 12) => {
      const flat = [];
      Object.entries(history || {}).forEach(([id, sessions]) => {
        (Array.isArray(sessions) ? sessions : []).forEach(s => {
          if (s?.date) flat.push({ id, date: s.date });
        });
      });
      flat.sort((a, b) => new Date(b.date) - new Date(a.date));
      const seen = new Set();
      const result = [];
      for (const item of flat) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item.id);
        if (result.length >= limit) break;
      }
      return result;
    };

    const deriveUsageCountsFromHistory = (history = {}) => {
      const counts = {};
      Object.entries(history || {}).forEach(([id, sessions]) => {
        (Array.isArray(sessions) ? sessions : []).forEach(s => {
          const increment = Math.max(1, Array.isArray(s?.sets) ? s.sets.length : 0);
          counts[id] = (counts[id] || 0) + increment;
        });
      });
      return counts;
    };

    const normalizeSearch = (value = '') => value.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const SEARCH_ALIASES = {
      rdl: 'romanian deadlift',
      ohp: 'overhead press',
      bp: 'bench press',
      'lat pulldown': 'lat pulldown lat pull-down lat pull down',
      dl: 'deadlift',
      squat: 'squat back squat',
      row: 'row bent-over row',
    };

    const fuzzyMatchExercises = (query, pool) => {
      const normalized = normalizeSearch(query);
      if (!normalized) return pool.slice(0, 20);

      const scores = pool.map((id) => {
        const eq = EQUIPMENT_DB[id];
        const haystack = [
          eq?.name || '',
          eq?.target || '',
          (eq?.tags || []).join(' '),
          Object.entries(SEARCH_ALIASES)
            .filter(([alias]) => normalized.includes(alias))
            .map(([, str]) => str)
            .join(' ')
        ].join(' ').toLowerCase();

        const baseScore = haystack.startsWith(normalized) ? 2 : (haystack.includes(normalized) ? 1 : 0);
        return { id, score: baseScore };
      }).filter(item => item.score > 0);

      return scores.sort((a, b) => b.score - a.score).map(s => s.id).slice(0, 20);
    };

    const calculatePlateLoading = (targetWeight, barWeight = 45) => {
      const plateOptions = [45, 35, 25, 10, 5, 2.5];
      const perSide = (targetWeight - barWeight) / 2;
      
      if (perSide <= 0) return { plates: [], perSide: 0, total: barWeight, display: 'Empty bar' };
      
      const plates = [];
      let remaining = perSide;
      
      for (const plate of plateOptions) {
        while (remaining >= plate) {
          plates.push(plate);
          remaining -= plate;
        }
      }
      
      const totalPerSide = plates.reduce((sum, p) => sum + p, 0);
      const total = barWeight + (totalPerSide * 2);
      
      return {
        plates,
        perSide: totalPerSide,
        total,
        display: plates.length > 0 ? plates.join(' + ') + ' per side' : 'Empty bar'
      };
    };

    const getProgressionAdvice = (sessions, currentBest) => {
      if (!sessions || sessions.length < 2) return null;
      const recentSessions = sessions.slice(-3);
      let easyCount = 0, goodCount = 0, hardCount = 0, atBest = 0;

      recentSessions.forEach(session => {
        (Array.isArray(session.sets) ? session.sets : []).forEach(set => {
          if (set.weight === currentBest) {
            atBest++;
            if (set.difficulty === 'easy') easyCount++;
            if (set.difficulty === 'good') goodCount++;
            if (set.difficulty === 'hard') hardCount++;
          }
        });
      });

      if (atBest >= 3 && (easyCount >= 2 || (easyCount + goodCount >= 3))) return { type: 'ready', message: 'Ready to bump weight next time' };
      if (atBest >= 2 && (goodCount + hardCount >= 2)) return { type: 'building', message: 'Keep building - you are close' };
      return null;
    };

    // getCoachMessage is defined in data/copy.js

    const Card = ({ children, className = '', onClick, style }) => (
      <div
        onClick={onClick}
        style={style}
        className={`ps-card ${className}`}
      >
        {children}
      </div>
    );

    const InlineMessage = ({ message }) => {
      if (!message) return null;
      return (
        <div className="px-4 pt-3">
          <div className="inline-message">{message}</div>
        </div>
      );
    };

    const UndoToast = ({ message, onUndo }) => {
      if (!message) return null;
      return (
        <div className="toast toast--undo" role="status" aria-live="polite">
          <span>{message}</span>
          <button onClick={onUndo} className="toast-action">Undo</button>
        </div>
      );
    };

    const LockedInGate = ({ onLockedIn, onBrowse }) => (
      <div className="locked-in-gate">
        <div className="locked-in-card card-enter">
          <h1 className="locked-in-title">Ready to lock in?</h1>
          <p className="locked-in-text">
            Turn this session into a promise. Once you tap in, you're here to work.
          </p>
          <div className="locked-in-actions">
            <button
              type="button"
              className="btn-primary ps-tap"
              onClick={onLockedIn}
            >
              I'm Locked In
            </button>
            <button
              type="button"
              className="btn-secondary-flat ps-tap"
              onClick={onBrowse}
            >
              I'm Just Browsing
            </button>
          </div>
        </div>
      </div>
    );

    const TemplatePicker = ({ isOpen, onClose, onSelect, plans = [] }) => {
      if (!isOpen) return null;

      return (
        <div className="template-picker-backdrop">
          <div className="template-picker card-enter">
            <div className="template-picker-header">
              <h2 className="template-picker-title">Start from template</h2>
              <button
                type="button"
                className="btn-secondary-flat ps-tap text-xs"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
            <div className="template-picker-list">
              {plans.map((plan) => (
                <button
                  key={plan.id || plan.name}
                  type="button"
                  className="template-picker-item ps-card-interactive ps-tap"
                  onClick={() => onSelect(plan)}
                >
                  <div className="template-picker-name">{plan.name}</div>
                  {plan.description && (
                    <div className="template-picker-desc">{plan.description}</div>
                  )}
                  {Array.isArray(plan.exercises) && (
                    <div className="template-picker-meta">
                      {plan.exercises.length} exercises
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const ToastHost = ({ toasts }) => {
      if (!toasts.length) return null;

      return (
        <div className="toast-host">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast card-enter">
              <div className="toast-text">{toast.message}</div>
            </div>
          ))}
        </div>
      );
    };

    const TabBar = ({ currentTab, setTab, onWorkoutTripleTap }) => {
      const tapCountRef = React.useRef(0);
      const tapTimerRef = React.useRef(null);

      const handleWorkoutTap = () => {
        if (currentTab === 'workout') {
          tapCountRef.current += 1;
          if (tapCountRef.current === 3) {
            tapCountRef.current = 0;
            if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
            onWorkoutTripleTap?.();
            return;
          }
          if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
          tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1000);
        } else {
          tapCountRef.current = 0;
          if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
        }
        setTab('workout');
      };

      React.useEffect(() => {
        return () => { if (tapTimerRef.current) clearTimeout(tapTimerRef.current); };
      }, []);

      return (
        <div className="fixed bottom-0 left-0 right-0 tabbar z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around items-center h-16 px-2">
            {[
              { id: 'home', label: 'Home', icon: 'Home' },
              { id: 'workout', label: 'Workout', icon: 'Dumbbell' }
            ].map(t => (
              <button 
                key={t.id} 
                onClick={t.id === 'workout' ? handleWorkoutTap : () => setTab(t.id)} 
                className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${
                  currentTab === t.id 
                    ? 'tab-active' 
                    : 'text-gray-400'
                }`}
              >
                <Icon name={t.icon} className="w-6 h-6" />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    };

    const ToggleRow = ({ icon, title, subtitle, enabled, onToggle }) => (
      <button
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between py-2"
      >
        <div className="flex items-center gap-3 text-left">
          <Icon name={icon} className="w-5 h-5 text-purple-600" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">{title}</div>
            {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
          </div>
        </div>
        <div className={`w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform m-0.5 ${enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </div>
      </button>
    );

    // ========== ONBOARDING ==========
// Intro + onboarding flow
const OnboardingProgress = ({ step, total }) => (
  <div className="onboarding-progress">
    {[...Array(total)].map((_, idx) => (
      <div key={idx} className={`dot ${idx <= step ? 'active' : ''}`} />
    ))}
    <span className="text-xs font-semibold text-gray-500">{step + 1} / {total}</span>
  </div>
);

const OnboardingCardShell = ({ children, step, total, onSkip }) => (
  <div className="onboarding-card animate-slide-up">
    <div className="flex items-start justify-between">
      <OnboardingProgress step={step} total={total} />
      {onSkip && <button className="ghost-button text-sm" onClick={onSkip}>Skip</button>}
    </div>
    {children}
  </div>
);

const OnboardingIntro = ({ title, subhead, body, step, total, onNext, onSkip, emoji }) => (
  <OnboardingCardShell step={step} total={total} onSkip={onSkip}>
    <div className="flex flex-col items-center text-center gap-3 flex-1">
      <div className="onboarding-hero">{emoji}</div>
      <h1 className="onboarding-title">{title}</h1>
      {subhead && <p className="onboarding-subhead">{subhead}</p>}
      <p className="onboarding-body">{body}</p>
    </div>
    <div className="onboarding-actions">
      <button className="ghost-button" onClick={onSkip}>Skip</button>
      <button className="accent-button" onClick={onNext}>Next</button>
    </div>
  </OnboardingCardShell>
);

const OnboardingForm = ({ profile, setProfile, onComplete, onBack, step, total }) => {
  const canStart = profile.username && profile.avatar && profile.workoutLocation;
  const locationOptions = [
    { id: 'gym', label: 'Gym', detail: 'Commercial gym or studio', gymType: 'commercial' },
    { id: 'home', label: 'Home', detail: 'Garage, apartment, or backyard', gymType: 'home' },
    { id: 'other', label: 'Other', detail: 'Travel or mixed', gymType: 'commercial' },
  ];

  return (
    <OnboardingCardShell step={step} total={total}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-500 uppercase">Quick setup</div>
        {onBack && <button className="ghost-button text-sm" onClick={onBack}>Back</button>}
      </div>
      <div className="space-y-3 flex-1 flex flex-col">
        <div className="form-tile">
          <label className="field-label">Name</label>
            <input
              type="text"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              className="input-surface"
              placeholder="Your name"
            />
          </div>

        <div className="form-tile">
          <label className="field-label">Emoji avatar</label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setProfile({ ...profile, avatar: a })}
                  className={`p-3 rounded-xl text-2xl border ${profile.avatar === a ? 'border-purple-400 bg-purple-50' : 'bg-gray-50 border-gray-200'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

        <div className="form-tile">
          <label className="field-label">Where are you working out?</label>
          <div className="flex items-stretch justify-center gap-2">
            {locationOptions.map((loc) => (
              <button
                key={loc.id}
                onClick={() => setProfile({ ...profile, workoutLocation: loc.id, gymType: loc.gymType })}
                className={`flex-1 min-w-0 rounded-xl border-2 px-3 py-3 text-center transition-all flex flex-col items-center gap-1 ${
                  profile.workoutLocation === loc.id ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-xl">{loc.id === 'gym' ? '🏋️' : loc.id === 'home' ? '🏠' : '🧳'}</div>
                <div className={`text-sm font-bold ${profile.workoutLocation === loc.id ? 'text-purple-700' : 'text-gray-900'}`}>{loc.label}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{loc.detail}</div>
                {profile.workoutLocation === loc.id && <Icon name="Check" className="w-4 h-4 text-purple-600" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="onboarding-actions">
        <button
          onClick={() => { if (canStart) onComplete(); }}
          disabled={!canStart}
          className="accent-button"
        >
          Start Tracking
        </button>
      </div>
    </OnboardingCardShell>
  );
};

const OnboardingFlow = ({ profile, setProfile, onFinish }) => {
  const [step, setStep] = useState(0);
  const steps = COPY_ONBOARDING_STEPS;

  const total = steps.length;

  return (
    <div className="onboarding-shell">
      {steps[step].type === 'intro' ? (
        <OnboardingIntro
          title={steps[step].title}
          subhead={steps[step].subhead}
          body={steps[step].body}
          emoji={steps[step].emoji}
          step={step}
          total={total}
          onSkip={() => setStep(total - 1)}
          onNext={() => setStep(Math.min(step + 1, total - 1))}
        />
      ) : (
        <OnboardingForm
          profile={profile}
          setProfile={setProfile}
          onComplete={onFinish}
          onBack={() => setStep((prev) => Math.max(prev - 1, 0))}
          step={step}
          total={total}
        />
      )}
    </div>
  );
};

// ========== CALCULATIONS ==========
    const getBestForEquipment = (sessions = []) => {
      let best = 0;
      sessions.forEach(s => {
        (Array.isArray(s.sets) ? s.sets : []).forEach(set => { if (set.weight > best) best = set.weight; });
      });
      return best || null;
    };

    const getStrongWeightForEquipment = (_profile, equipId, sessions = []) => {
      const best = getBestForEquipment(sessions);
      if (best) return best;
      const eq = EQUIPMENT_DB[equipId];
      const starter = eq?.tags?.includes('Legs') ? 45 : 15;
      return clampTo5(starter);
    };

    const getNextTarget = (_profile, equipId, best) => {
      const eq = EQUIPMENT_DB[equipId];
      const increment = eq?.tags?.includes('Legs') ? 10 : 5;
      return clampTo5((best || getStrongWeightForEquipment({}, equipId, [])) + increment);
    };

    const computeStrengthScore = (_profile, history) => {
      const ids = Object.keys(EQUIPMENT_DB).filter(id => EQUIPMENT_DB[id]?.type !== 'cardio');
      const logged = ids.filter(id => Array.isArray(history[id]) && history[id].length > 0);

      if (logged.length === 0) {
        return { score: 0, avgPct: 0, coveragePct: 0, loggedCount: 0, total: ids.length };
      }

      const ratios = logged.map(id => {
        const sessions = Array.isArray(history[id]) ? history[id] : [];
        if (sessions.length === 0) return 0;
        const first = sessions[0];
        const best = getBestForEquipment(sessions);
        const firstBest = getBestForEquipment([first]);
        if (!firstBest || !best) return 0.3;
        const improvement = Math.max(0, best - firstBest);
        const pct = Math.min(1, (improvement / (firstBest || 1)) * 0.5 + 0.5);
        return pct;
      });

      const avg = ratios.reduce((a,b)=>a+b,0) / ratios.length;
      const coverage = logged.length / ids.length;
      const score01 = (avg * 0.7) + (coverage * 0.3);
      const score = Math.round(score01 * 100);

      return { score, avgPct: Math.round(avg*100), coveragePct: Math.round(coverage*100), loggedCount: logged.length, total: ids.length };
    };

    const computeAchievements = ({ history, cardioHistory = {}, strengthScoreObj, streakObj }) => {
      const days = uniqueDayKeysFromHistory(history, cardioHistory);
      const strengthSessions = Object.values(history || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const cardioSessions = Object.values(cardioHistory || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const sessionsTotal = strengthSessions + cardioSessions;
      const equipmentLogged = Object.keys(EQUIPMENT_DB).filter(id => Array.isArray(history[id]) && history[id].length > 0).length;

      const unlocks = [
        { id: 'first', title: 'First Log', desc: 'Logged your first session', unlocked: sessionsTotal >= 1, emoji: '✅' },
        { id: '3days', title: '3-Day Streak', desc: '3 consecutive training days', unlocked: streakObj.best >= 3, emoji: '🔥' },
        { id: '7days', title: '7-Day Streak', desc: '7 consecutive training days', unlocked: streakObj.best >= 7, emoji: '🏆' },
        { id: 'score50', title: 'Strength Tier 50', desc: 'Strength Score hit 50', unlocked: strengthScoreObj.score >= 50, emoji: '💪' },
        { id: 'score75', title: 'Strength Tier 75', desc: 'Strength Score hit 75', unlocked: strengthScoreObj.score >= 75, emoji: '⚡' },
        { id: 'equipment5', title: 'Explorer', desc: 'Logged 5+ exercises', unlocked: equipmentLogged >= 5, emoji: '🧭' },
        { id: 'days10', title: 'Show Up Club', desc: 'Trained on 10 different days', unlocked: days.length >= 10, emoji: '📅' },
      ];

      return unlocks;
    };

    const getTodaysWorkoutType = (history, appState) => {
      const order = ["Push","Pull","Legs"];
      const lastType = appState?.lastWorkoutType || null;
      const lastDayKey = appState?.lastWorkoutDayKey || null;
      const todayKey = toDayKey(new Date());

      if (lastDayKey === todayKey && lastType) return lastType;
      if (!lastType) return "Push";
      
      const idx = order.indexOf(lastType);
      return order[(idx + 1) % order.length] || "Push";
    };

    // ========== HOME SCREEN ==========
    
const GeneratorOptions = ({ options, onUpdate, compact = false }) => {
  const goalOptions = [
    { id: 'strength', label: 'Strength' },
    { id: 'hypertrophy', label: 'Hypertrophy' },
    { id: 'quick', label: 'Quick' }
  ];
  const durationOptions = [30, 45, 60];
  const toggleOption = (key, value) => {
    onUpdate(prev => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  };

  return (
    <div className={`space-y-2 ${compact ? 'text-xs' : ''}`}>
      <div className="text-[11px] font-bold text-gray-500 uppercase">Optional tweaks</div>
      <div className="flex flex-wrap gap-2">
        {goalOptions.map(opt => (
          <button
            key={opt.id}
            onClick={() => toggleOption('goal', opt.id)}
            className={`filter-chip ${options.goal === opt.id ? 'active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {durationOptions.map(value => (
          <button
            key={value}
            onClick={() => toggleOption('duration', value)}
            className={`filter-chip ${options.duration === value ? 'active' : ''}`}
          >
            {value} min
          </button>
        ))}
      </div>
    </div>
  );
};

const MatrixWaterfall = ({ show, onClose }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ01234567890';
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0F0';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={onClose}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="text-2xl font-mono text-green-400"
          style={{ textShadow: '0 0 20px rgba(0,255,0,0.8)', opacity: 0.7, animation: 'fadeIn 2s' }}
        >
          Wake up, Neo...
        </div>
      </div>
    </div>
  );
};

const PowerUpEffect = ({ show, onClose }) => {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black opacity-90"></div>
      
      <div className="relative z-10 text-center">
        <div 
          className="text-7xl font-black mb-4"
          style={{
            background: 'linear-gradient(45deg, #FFD700, #FFA500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(255,215,0,0.8)',
            animation: 'powerPulse 0.5s infinite alternate'
          }}
        >
          IT'S OVER 9000!
        </div>
        <div className="text-2xl text-yellow-400 font-bold">
          ⚡ POWER LEVEL: MAXIMUM ⚡
        </div>
      </div>

      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)',
          animation: 'auraExpand 1.5s ease-out infinite'
        }}
      ></div>

      <style>{`
        @keyframes powerPulse {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        @keyframes auraExpand {
          from { transform: scale(0.8); opacity: 0.8; }
          to { transform: scale(1.2); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

const GloryEasterEgg = ({ show, onClose }) => {
  const [phase, setPhase] = useState(0);
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    if (!show) {
      setPhase(0);
      setConfetti([]);
      return;
    }
    
    const timer1 = setTimeout(() => setPhase(1), 300);
    const timer2 = setTimeout(() => {
      setPhase(2);
      const newConfetti = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        rotate: Math.random() * 360,
        color: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#95E1D3'][Math.floor(Math.random() * 5)]
      }));
      setConfetti(newConfetti);
    }, 1800);
    
    const timer3 = setTimeout(onClose, 5000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={onClose}
    >
      <div className="text-center px-8">
        {phase >= 1 && (
          <div 
            className="text-4xl font-black text-white mb-4"
            style={{
              animation: 'slideDown 0.5s ease-out',
              textShadow: '0 0 20px rgba(255,215,0,0.5)'
            }}
          >
            Press it...
          </div>
        )}
        
        {phase >= 2 && (
          <div 
            className="text-5xl font-black mb-2"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'slideUp 0.6s ease-out, gloryPulse 2s ease-in-out infinite',
              textShadow: '0 0 30px rgba(255,215,0,0.8)'
            }}
          >
            Press it for GLORY!
          </div>
        )}
        
        {phase >= 2 && (
          <div 
            className="text-lg text-gray-400 font-semibold"
            style={{ animation: 'fadeIn 1s ease-in' }}
          >
            — Barney Stinson
          </div>
        )}
      </div>
      
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: c.x + '%',
            top: '-20px',
            backgroundColor: c.color,
            animation: `fall ${c.duration}s linear ${c.delay}s forwards`,
            transform: `rotate(${c.rotate}deg)`,
            boxShadow: `0 0 10px ${c.color}`
          }}
        />
      ))}
      
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gloryPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fall {
          to { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const SpartanKick = ({ show, onClose }) => {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-stone-800 to-red-900 opacity-95"></div>
      
      <div className="relative z-10 text-center" style={{ animation: 'kickImpact 0.5s ease-out' }}>
        <div className="text-8xl mb-4">🗡️</div>
        <div 
          className="text-7xl font-black mb-4 text-red-600"
          style={{
            textShadow: '4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000',
            animation: 'spartanShake 0.5s ease-in-out'
          }}
        >
          THIS IS SPARTA!
        </div>
        <div className="text-2xl text-amber-400 font-bold" style={{ textShadow: '2px 2px 4px #000' }}>
          ⚔️ TONIGHT WE LIFT IN GLORY ⚔️
        </div>
      </div>

      <style>{`
        @keyframes kickImpact {
          0% { transform: translateX(-100vw); }
          60% { transform: translateX(20px); }
          100% { transform: translateX(0); }
        }
        @keyframes spartanShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
      `}</style>
    </div>
  );
};

const ButDidYouDie = ({ show, onClose, onConfirm }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-80" onClick={onClose}></div>
      
      <div className="relative z-10 bg-gray-900 rounded-3xl p-8 max-w-sm mx-4 border-4 border-purple-500">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">💀</div>
          <div className="text-4xl font-black text-white mb-2">BUT DID YOU DIE?</div>
          <div className="text-sm text-gray-400">Rest is important, but so is consistency...</div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-xl font-bold active:scale-95"
          >
            Nevermind
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold active:scale-95"
          >
            Log Rest Day
          </button>
        </div>
      </div>
    </div>
  );
};

const NiceToast = ({ show }) => {
  if (!show) return null;

  return (
    <div 
      className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40 bg-purple-600 text-white px-6 py-3 rounded-full font-bold shadow-lg"
      style={{ animation: 'niceSlide 2s ease-in-out' }}
    >
      Nice 😎
      <style>{`
        @keyframes niceSlide {
          0% { transform: translate(-50%, 100px); opacity: 0; }
          20% { transform: translate(-50%, 0); opacity: 1; }
          80% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 100px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const PerfectWeek = ({ show, onClose }) => {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-black opacity-95"></div>
      
      <div className="relative z-10 text-center">
        <div className="text-7xl mb-6">🎩</div>
        <div 
          className="text-6xl font-black mb-4"
          style={{
            background: 'linear-gradient(45deg, #FFD700, #FF1493, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'perfectPulse 1s ease-in-out infinite'
          }}
        >
          YOU JUST PULLED
        </div>
        <div 
          className="text-7xl font-black mb-4"
          style={{
            background: 'linear-gradient(135deg, #4169E1, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(255,215,0,0.8)'
          }}
        >
          A BARNEY!
        </div>
        <div className="text-3xl text-white font-bold mb-2">✋ PERFECT WEEK ✋</div>
        <div className="text-xl text-purple-300">7 days, 7 workouts. Legendary.</div>
      </div>

      <style>{`
        @keyframes perfectPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

const Home = ({
  profile,
  lastWorkoutLabel,
  lastSessionSummary,
  lastSessionShortLabel,
  lastSessionDetail,
  suggestedFocus,
  dayEntries,
  lastWorkoutDate,
  onStartWorkout,
  homeQuote,
  coachMessage,
  isRestDay,
  sessionIntent,
  onLogRestDay,
  onUndoRestDay,
  onTriggerGlory,
  onLongPressRestDay,
  onOpenTemplatesFromHome,
  onOpenHistoryFromHome,
  onOpenSettingsFromHome
}) => {
  const longPressTimerRef = useRef(null);
  const restDayTimerRef = useRef(null);
  const [isHolding, setIsHolding] = useState(false);
  const [isHoldingRestDay, setIsHoldingRestDay] = useState(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (restDayTimerRef.current) clearTimeout(restDayTimerRef.current);
    };
  }, []);

  const handleAvatarTouchStart = () => {
    setIsHolding(true);
    longPressTimerRef.current = setTimeout(() => {
      setIsHolding(false);
      onTriggerGlory();
    }, 1500);
  };

  const handleAvatarTouchEnd = () => {
    setIsHolding(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleRestDayTouchStart = (e) => {
    if (isRestDay) return;
    e.preventDefault();
    setIsHoldingRestDay(true);
    restDayTimerRef.current = setTimeout(() => {
      setIsHoldingRestDay(false);
      onLongPressRestDay();
    }, 2000);
  };

  const handleRestDayTouchEnd = () => {
    setIsHoldingRestDay(false);
    if (restDayTimerRef.current) {
      clearTimeout(restDayTimerRef.current);
      restDayTimerRef.current = null;
    }
  };

  const handleRestDayClick = () => {
    if (restDayTimerRef.current) {
      clearTimeout(restDayTimerRef.current);
      restDayTimerRef.current = null;
    }
    if (!isHoldingRestDay) {
      if (isRestDay) {
        onUndoRestDay();
      } else {
        onLogRestDay();
      }
    }
  };

  const handleHomeTemplatesClick = () => {
    onOpenTemplatesFromHome?.();
  };

  const handleHomeLastSessionClick = () => {
    onOpenHistoryFromHome?.();
  };

  const homeStartSubtext = 'Plan your workout in seconds.';

  const muscleGroups = useMemo(() => ([
    { label: 'Chest', key: 'chest' },
    { label: 'Back', key: 'back' },
    { label: 'Legs', key: 'legs' },
    { label: 'Core', key: 'core' },
    { label: 'Arms', key: 'arms' },
    { label: 'Shoulders', key: 'shoulders' }
  ]), []);

  return (
    <div className="flex flex-col h-full bg-gray-50 home-screen">
      <div className="ps-hero-header sticky top-0 z-20">
        <div className="ps-hero-header__inner">
          <div className="ps-hero-header__left">
            <div className="ps-hero-header__brand select-none">PLANET STRENGTH</div>
            <div className="ps-hero-header__welcome">
              Welcome back, <span className="ps-hero-header__name">{profile.username || 'Athlete'}.</span>
            </div>
          </div>
          <div className="ps-hero-header__icons">
            <button
              type="button"
              onClick={handleRestDayClick}
              onTouchStart={handleRestDayTouchStart}
              onTouchEnd={handleRestDayTouchEnd}
              onMouseDown={handleRestDayTouchStart}
              onMouseUp={handleRestDayTouchEnd}
              onMouseLeave={handleRestDayTouchEnd}
              className="ps-nav-icon-btn"
              style={{ transform: isHoldingRestDay ? 'scale(0.9)' : 'scale(1)', transition: 'all 0.1s ease' }}
              title={isRestDay ? 'Undo rest day' : 'Log rest day'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
              </svg>
            </button>
            <button
              type="button"
              className="ps-nav-icon-btn"
              onClick={onOpenSettingsFromHome}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <div
              className="ps-nav-icon-btn ps-nav-icon-btn--avatar"
              style={{
                transform: isHolding ? 'scale(0.9)' : 'scale(1)',
                transition: 'all 0.1s ease'
              }}
              onTouchStart={handleAvatarTouchStart}
              onTouchEnd={handleAvatarTouchEnd}
              onMouseDown={handleAvatarTouchStart}
              onMouseUp={handleAvatarTouchEnd}
              onMouseLeave={handleAvatarTouchEnd}
              title="Profile"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="ps-manifesto-ticker">
        <div className="ps-ticker-track">
          {COPY_TICKER.map((item, i) => (
            <span key={i} className={`ps-ticker-item${i % 2 === 0 ? ' ps-ticker-item--hi' : ''}`}>
              <span className="ps-ticker-dot" />
              {item}
            </span>
          ))}
          {COPY_TICKER.map((item, i) => (
            <span key={`r${i}`} className={`ps-ticker-item${i % 2 === 0 ? ' ps-ticker-item--hi' : ''}`}>
              <span className="ps-ticker-dot" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 home-content ps-home-scroll">
        <div className="ps-home-stack">
          <button onClick={onStartWorkout} className="home-primary-button ps-cta-btn card-enter">
            Build Today's Workout
          </button>
          <div className="ps-mini-tiles">
            <button type="button" className="home-mini-tile" onClick={handleHomeTemplatesClick}>
              <div className="home-mini-label">Quick Start</div>
              <div className="home-mini-title">Templates</div>
              <div className="home-mini-accent">Start</div>
              <div className="home-mini-subtitle">Without Thinking</div>
            </button>
            <button type="button" className="home-mini-tile" onClick={handleHomeLastSessionClick}>
              <div className="home-mini-label">Previous</div>
              <div className="home-mini-title">Last Session</div>
              <div className="home-lastsession-top">
                {lastSessionShortLabel || lastWorkoutLabel || '—'}
              </div>
              <div className="home-lastsession-bottom">
                {lastSessionDetail || '—'}
              </div>
            </button>
          </div>
          {homeQuote && (
            <div className="home-section-card home-quote">
              <div className="home-section-title">Inspiration</div>
              <div className="quote-block">
                <p className="quote-text">“{homeQuote.text}”</p>
                <p className="quote-meta">— {homeQuote.movie}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Workout = ({ profile, history, cardioHistory, colorfulExerciseCards, onSelectExercise, settings, setSettings, recentExercises, starredExercises, onToggleStarred, exerciseUsageCounts, activeSession, onFinishSession, onStartWorkoutFromBuilder, onAddExerciseFromSearch, onPushMessage, onRemoveSessionExercise, onSwapSessionExercise, onStartEmptySession, isRestDay, onCancelSession, sessionIntent, onApplyTemplate, openTemplatesFromHome, onConsumedOpenTemplatesFromHome, onOpenSettings, onToggleRestDay }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [libraryVisible, setLibraryVisible] = useState(settings.showAllExercises);
  const [swapState, setSwapState] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showCompactSearch, setShowCompactSearch] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchResultsRef = useRef(null);
  const sessionCardRef = useRef(null);
  const lastSessionStatusRef = useRef(activeSession?.status || null);

  useEffect(() => {
    if (openTemplatesFromHome) {
      setIsTemplatePickerOpen(true);
      onConsumedOpenTemplatesFromHome?.();
    }
  }, [openTemplatesFromHome, onConsumedOpenTemplatesFromHome]);

  const gymType = GYM_TYPES[profile.gymType];

  const availableEquipment = useMemo(() => {
    const ids = Object.keys(EQUIPMENT_DB);
    return ids.filter(id => {
      const eq = EQUIPMENT_DB[id];
      if (eq.type === 'cardio') return true;
      if (eq.type === 'easterEgg') return true;
      if (eq.type === 'machine') return gymType?.machines;
      if (eq.type === 'dumbbell') return gymType?.dumbbells?.available;
      if (eq.type === 'barbell') return gymType?.barbells?.available;
      return false;
    });
  }, [gymType]);

  const filteredRecents = recentExercises.filter(id => availableEquipment.includes(id)).slice(0, 10);
  const filteredStarred = (starredExercises || []).filter(id => availableEquipment.includes(id));
  const todayKey = toDayKey(new Date());
  const hasSession = !!activeSession;
  const hasTodayWorkout = hasSession && activeSession?.date === todayKey;
  const mode = !hasTodayWorkout ? 'idle' : (activeSession?.status === 'active' ? 'active' : 'draft');
  const isSessionMode = mode === 'active';
  const isDraft = mode === 'draft';
  const sessionEntries = useMemo(() => {
    if (!activeSession || activeSession.date !== todayKey) return [];
    return activeSession.items || [];
  }, [activeSession, todayKey]);
  const sessionLogsByExercise = activeSession?.date === todayKey ? (activeSession?.logsByExercise || {}) : {};
  const sessionHasLogged = sessionEntries.some(entry => (sessionLogsByExercise[entry.exerciseId || entry.id] || []).length > 0);
  const sessionExerciseCount = sessionEntries.length;
  const sessionSetCount = sessionEntries.reduce((sum, entry) => sum + ((sessionLogsByExercise[entry.exerciseId || entry.id] || []).length), 0);
  const finishSummaryBase = `${sessionExerciseCount} exercises • ${sessionSetCount} sets`;
  const finishSummaryIntent = sessionIntent === 'calm'
    ? 'Calm pace'
    : sessionIntent === 'recovery'
      ? 'Recovery pace'
      : '';
  const finishSummaryText = finishSummaryIntent ? `${finishSummaryBase} • ${finishSummaryIntent}` : finishSummaryBase;

  const filterOptions = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  const templatePlans = useMemo(() => {
    if (!WORKOUT_PLANS) return [];
    const labels = {
      Push: {
        name: 'Push Day',
        description: 'Upper body – chest, shoulders & triceps.'
      },
      Pull: {
        name: 'Pull Day',
        description: 'Upper body – back & biceps focus.'
      },
      Legs: {
        name: 'Legs Day',
        description: 'Lower body – quads, glutes & hamstrings.'
      },
      Core: {
        name: 'Core Day',
        description: 'Core & abs – anti-slouch session.'
      },
      'Full Body': {
        name: 'Full Body Day',
        description: 'Balanced mix of upper & lower body.'
      }
    };

    const planOrder = ['Push', 'Pull', 'Legs', 'Core', 'Full Body'];
    return planOrder
      .filter((name) => WORKOUT_PLANS[name])
      .map((name) => {
        const plan = WORKOUT_PLANS[name] || {};
        const exerciseIds = [
          ...(plan.machines || []),
          ...(plan.dumbbells || []),
          ...(plan.barbells || [])
        ];
        const uniqueIds = Array.from(new Set(exerciseIds));
        const label = labels[name] || {};
        return {
          id: name.toLowerCase().replace(/\\s+/g, '-'),
          name: label.name || `${name} Day`,
          description: label.description || `A focused ${name.toLowerCase()} template.`,
          exercises: uniqueIds.map((exerciseId) => {
            const eq = EQUIPMENT_DB[exerciseId] || {};
            return {
              id: exerciseId,
              name: eq.name || exerciseId,
              muscleGroup: eq.target || null,
              equipment: eq.type || null
            };
          })
        };
      });
  }, []);

  const resolveGroup = (eq) => {
    if (eq?.type === 'cardio') return 'Cardio';
    const target = (eq?.target || '').toLowerCase();
    if (target.includes('chest') || target.includes('pec')) return 'Chest';
    if (target.includes('back') || target.includes('lat')) return 'Back';
    if (target.includes('leg') || target.includes('quad') || target.includes('hamstring') || target.includes('glute') || target.includes('calf') || target.includes('thigh')) return 'Legs';
    if (target.includes('shoulder') || target.includes('delt')) return 'Shoulders';
    if (target.includes('bicep') || target.includes('tricep') || target.includes('arm') || target.includes('forearm')) return 'Arms';
    if (target.includes('core') || target.includes('ab')) return 'Core';
    return 'Other';
  };

  const formatOptionLabel = (value, type) => {
    if (!value) return '';
    if (type === 'equipment') {
      if (value === 'free') return 'Free weights';
      if (value === 'machines') return 'Machines';
      if (value === 'mixed') return 'Mixed';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const starredSet = useMemo(() => new Set(starredExercises || []), [starredExercises]);
  const baseOrder = useMemo(() => {
    return new Map(availableEquipment.map((id, idx) => [id, idx]));
  }, [availableEquipment]);

  const sortByStarWithinGroup = useCallback((ids) => {
    return [...ids].sort((a, b) => {
      const groupA = resolveGroup(EQUIPMENT_DB[a]);
      const groupB = resolveGroup(EQUIPMENT_DB[b]);
      if (groupA !== groupB) {
        return (baseOrder.get(a) ?? 0) - (baseOrder.get(b) ?? 0);
      }
      const aStar = starredSet.has(a);
      const bStar = starredSet.has(b);
      if (aStar !== bStar) return aStar ? -1 : 1;
      return (baseOrder.get(a) ?? 0) - (baseOrder.get(b) ?? 0);
    });
  }, [baseOrder, starredSet]);

  const filteredPool = useMemo(() => {
    let pool = [];
    if (activeFilter === 'All') pool = availableEquipment;
    else if (activeFilter === 'Cardio') pool = availableEquipment.filter(id => EQUIPMENT_DB[id]?.type === 'cardio');
    else pool = availableEquipment.filter(id => resolveGroup(EQUIPMENT_DB[id]) === activeFilter);
    return sortByStarWithinGroup(pool);
  }, [activeFilter, availableEquipment, sortByStarWithinGroup]);

  // Use debounced query for search results (better performance)
  const searchResults = useMemo(() => {
    const pool = filteredPool;
    if (!debouncedSearchQuery.trim()) return [];
    return fuzzyMatchExercises(debouncedSearchQuery, pool);
  }, [debouncedSearchQuery, filteredPool]);

  useEffect(() => {
    setLibraryVisible(settings.showAllExercises);
  }, [settings.showAllExercises]);

  useEffect(() => {
    if (mode === 'idle') {
      setShowCompactSearch(false);
    }
  }, [mode]);


  useEffect(() => {
    if (!debouncedSearchQuery.trim() || !searchResultsRef.current) return;
    requestAnimationFrame(() => {
      searchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [debouncedSearchQuery, searchResults.length]);

  useEffect(() => {
    const prevStatus = lastSessionStatusRef.current;
    if (activeSession?.status === 'active' && prevStatus !== 'active') {
      requestAnimationFrame(() => {
        sessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    lastSessionStatusRef.current = activeSession?.status || null;
  }, [activeSession?.status]);


  const getExerciseIcon = (eq) => {
    if (!eq) return '🏋️‍♂️';
    if (eq.emoji) return eq.emoji;
    if (eq.type === 'cardio') return eq.cardioGroup === 'swimming' ? '🏊' : '🏃';
    if (eq.type === 'machine') return '⚙️';
    if (eq.type === 'dumbbell') return '🏋️';
    return '🏋️‍♂️';
  };

  const renderStarIcon = (isStarred) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={isStarred ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );

  const resolveCategoryClass = (label = '') => {
    const normalizedCategory = normalizeMuscleGroup(label);
    if (!normalizedCategory) return '';
    if (['chest', 'back', 'legs', 'core', 'arms', 'shoulders'].includes(normalizedCategory)) {
      return `category-${normalizedCategory}`;
    }
    return '';
  };

  const getLastStrengthSet = useCallback((exerciseId) => {
    const sessions = safeArray(history?.[exerciseId]);
    if (sessions.length === 0) return null;
    const lastSession = sessions.reduce((latest, session) => {
      if (!latest) return session;
      const latestTime = new Date(latest.date || 0).getTime();
      const sessionTime = new Date(session.date || 0).getTime();
      return sessionTime > latestTime ? session : latest;
    }, null);
    const sets = safeArray(lastSession?.sets);
    if (!sets.length) return null;
    return sets[sets.length - 1];
  }, [history]);

  const buildExerciseMeta = useCallback((exerciseId) => {
    const eq = EQUIPMENT_DB[exerciseId];
    if (!eq || eq.type === 'cardio') return 'No sets logged yet';
    const lastSet = getLastStrengthSet(exerciseId);
    if (!lastSet) return 'No sets logged yet';
    const weight = Number(lastSet.weight);
    const reps = Number(lastSet.reps);
    const hasWeight = Number.isFinite(weight) && weight > 0;
    const hasReps = Number.isFinite(reps) && reps > 0;
    if (hasWeight && hasReps) return `Last: ${weight} lb × ${reps}`;
    if (hasWeight) return `Last: ${weight} lb`;
    if (hasReps) return `Last: Bodyweight × ${reps}`;
    return 'No sets logged yet';
  }, [getLastStrengthSet]);

  const renderExerciseRow = (id, actionLabel = 'Add', onAction) => {
    const eq = EQUIPMENT_DB[id];
    if (!eq) return null;
    const isComingSoon = !!eq.comingSoon;
    const allowAdd = hasTodayWorkout && !isRestDay && !isComingSoon;
    const categoryClass = colorfulExerciseCards ? resolveCategoryClass(eq.target || eq.muscles || '') : '';
    const badgeGroup = normalizeMuscleGroup(eq);
    const isStarred = starredSet.has(id);
    const metaLabel = buildExerciseMeta(id);
    const muscleLabel = eq.type === 'cardio' ? 'Cardio' : eq.target;
    return (
      <div
        key={id}
        className={`exercise-library-card w-full p-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between ${categoryClass}`}
      >
        <div className="flex items-center gap-3 text-left flex-1 min-w-0">
          <div className="exercise-badge-wrapper">
            {renderMuscleBadge(badgeGroup)}
          </div>
          <div className="min-w-0">
            <div className="font-bold workout-heading text-sm leading-tight">{eq.name}</div>
            <div className="exercise-meta">{metaLabel}</div>
            {isComingSoon && (
              <div className="text-[11px] text-gray-400 font-semibold">Coming Soon</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] workout-muted">{muscleLabel}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStarred?.(id); }}
              className={`exercise-favorite-button ${isStarred ? 'is-starred' : ''}`}
              aria-label={isStarred ? 'Remove from favorites' : 'Add to favorites'}
            >
              {renderStarIcon(isStarred)}
            </button>
          </div>
          {allowAdd && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); (onAction ? onAction(id) : onAddExerciseFromSearch?.(id)); }}
              className="cues-accent font-semibold text-sm"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderExerciseTile = (id) => {
    const eq = EQUIPMENT_DB[id];
    if (!eq) return null;
    const isComingSoon = !!eq.comingSoon;
    const allowAdd = hasTodayWorkout && !isRestDay && !isComingSoon;
    const categoryClass = colorfulExerciseCards ? resolveCategoryClass(eq.target || eq.muscles || '') : '';
    const badgeGroup = normalizeMuscleGroup(eq);
    const isStarred = starredSet.has(id);
    const metaLabel = buildExerciseMeta(id);
    const muscleLabel = eq.type === 'cardio' ? 'Cardio' : eq.target;
    return (
      <div key={id} className={`tile text-left exercise-library-card ${categoryClass}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="exercise-badge-wrapper">
            {renderMuscleBadge(badgeGroup)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] workout-muted">{muscleLabel}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStarred?.(id); }}
              className={`exercise-favorite-button ${isStarred ? 'is-starred' : ''}`}
              aria-label={isStarred ? 'Remove from favorites' : 'Add to favorites'}
            >
              {renderStarIcon(isStarred)}
            </button>
          </div>
        </div>
        <div className="font-bold workout-heading text-sm leading-tight">{eq.name}</div>
        <div className="exercise-meta">{metaLabel}</div>
        {isComingSoon && (
          <div className="text-[11px] text-gray-400 font-semibold mt-1">Coming Soon</div>
        )}
        {allowAdd && (
          <div className="tile-actions">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddExerciseFromSearch?.(id); }}
              className="tile-action primary"
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  };

  const swapOptions = useMemo(() => {
    if (!swapState) return [];
    const sourceList = sessionEntries.map(entry => entry.exerciseId || entry.id);
    const currentId = sourceList[swapState.index];
    if (!currentId) return [];
    const current = EQUIPMENT_DB[currentId];
    const pool = availableEquipment.filter(id => id !== currentId && (!current || (EQUIPMENT_DB[id]?.target === current.target || EQUIPMENT_DB[id]?.tags?.some(t => current.tags?.includes(t)))));
    return pool.slice(0, 20);
  }, [swapState, availableEquipment, sessionEntries]);

  const handleSearchAdd = (id) => {
    if (!id) return;
    if (!hasTodayWorkout) return;
    const alreadyAdded = sessionEntries.some(entry => (entry.exerciseId || entry.id) === id);
    if (alreadyAdded) {
      onPushMessage?.('Already added');
      setSearchQuery('');
      requestAnimationFrame(() => {
        sessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    onAddExerciseFromSearch?.(id);
    setSearchQuery('');
    requestAnimationFrame(() => {
      sessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleBrowseAll = () => {
    setLibraryVisible(prev => !prev);
    setActiveFilter('All');
  };

  const handleSearchFocus = () => {
    if (!showCompactSearch) {
      setShowCompactSearch(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        searchInputRef.current?.focus();
      });
      return;
    }
    setShowCompactSearch(false);
  };

  const showIdleControls = mode === 'idle';
  const showCompactControls = mode !== 'idle';
  const showCompactSearchInput = showCompactControls && (showCompactSearch || !!searchQuery);

  return (
    <div className="flex flex-col h-full bg-gray-50 workout-shell relative">
      <div className="ps-hero-header sticky top-0 z-20">
        <div className="ps-hero-header__inner">
          <div className="ps-hero-header__left">
            <div className="ps-hero-header__brand select-none">PLANET STRENGTH</div>
            <div className="ps-hero-header__welcome">
              Workout, <span className="ps-hero-header__name">Let's build.</span>
            </div>
          </div>
          <div className="ps-hero-header__icons">
            <button type="button" className="ps-nav-icon-btn" onClick={onToggleRestDay} title="Rest day">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
              </svg>
            </button>
            <button type="button" className="ps-nav-icon-btn" onClick={onOpenSettings} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button type="button" className="ps-nav-icon-btn ps-nav-icon-btn--avatar" onClick={onOpenSettings} title="Profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="ps-manifesto-ticker">
        <div className="ps-ticker-track">
          {COPY_TICKER.map((item, i) => (
            <span key={i} className={`ps-ticker-item${i % 2 === 0 ? ' ps-ticker-item--hi' : ''}`}>
              <span className="ps-ticker-dot" />
              {item}
            </span>
          ))}
          {COPY_TICKER.map((item, i) => (
            <span key={`r${i}`} className={`ps-ticker-item${i % 2 === 0 ? ' ps-ticker-item--hi' : ''}`}>
              <span className="ps-ticker-dot" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto pb-28 px-4 space-y-4 workout-scroll ${isSessionMode ? 'workout-scroll--with-footer' : ''}`}>
        {showIdleControls && (
          <Card className="space-y-3 workout-card mt-5 start-today-card card-enter ps-card-interactive">
            <div>
              <div className="text-xs font-bold workout-muted uppercase">Start Today</div>
              <div className="text-base font-black workout-heading">Build today’s session</div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => onStartEmptySession?.()}
                disabled={isRestDay || hasTodayWorkout}
                className={`w-full py-3 rounded-xl font-bold active:scale-[0.98] ${
                  (isRestDay || hasTodayWorkout) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'accent-button'
                }`}
              >
                {hasTodayWorkout ? 'Drafted for today' : 'Start Today'}
              </button>
              <button
                onClick={handleBrowseAll}
                disabled={isRestDay}
                className={`w-full py-3 rounded-xl border font-bold active:scale-[0.98] ${
                  isRestDay ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'ps-browse-library-btn'
                }`}
              >
                {libraryVisible ? 'Close library' : 'Browse library'}
              </button>
            </div>
            <div className="relative">
              <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exercises..."
                ref={searchInputRef}
                disabled={isRestDay}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:text-gray-400"
              />
            </div>
            {!hasTodayWorkout && !isRestDay && (
              <div className="text-[11px] workout-muted">Create a draft to add exercises and start logging.</div>
            )}
          </Card>
        )}

        {showCompactControls && (
          <Card className="workout-card mt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold workout-muted uppercase">
                {mode === 'draft' ? 'Draft mode' : 'Workout active'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="pill-button"
                  onClick={handleBrowseAll}
                  disabled={isRestDay}
                >
                  {libraryVisible ? 'Close' : 'Browse all'}
                </button>
                <button
                  type="button"
                  className="pill-button"
                  onClick={handleSearchFocus}
                  disabled={isRestDay}
                >
                  Search
                </button>
                {mode === 'draft' && (
                  <button
                    type="button"
                    className="pill-button"
                    onClick={() => setIsTemplatePickerOpen(true)}
                    disabled={isRestDay}
                  >
                    Template
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}

        {showCompactSearchInput && (
          <Card className="workout-card">
            <div className="relative">
              <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exercises..."
                ref={searchInputRef}
                disabled={isRestDay}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:text-gray-400"
              />
            </div>
          </Card>
        )}

        {searchQuery && (
          <div ref={searchResultsRef}>
            <Card className="space-y-2 workout-card">
              <div className="text-xs font-bold workout-muted uppercase">Search Results</div>
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(id => renderExerciseRow(id, 'Add', handleSearchAdd))}
                </div>
              ) : (
                <div className="text-xs workout-muted">No matches yet. Try a different keyword.</div>
              )}
            </Card>
          </div>
        )}

        {!isRestDay && hasTodayWorkout && (
          <Card className="space-y-3 workout-card" ref={sessionCardRef}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold workout-muted uppercase">{isSessionMode ? 'Workout active' : 'Draft workout'}</div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-black workout-heading">Today’s Workout</div>
                  {activeSession?.createdFrom === 'generated' && (
                    <span className="session-badge">Generated</span>
                  )}
                </div>
                <div className="text-[11px] workout-muted">{isSessionMode ? 'Log as you go' : 'Edit and start when ready'}</div>
              </div>
              <button
                onClick={() => {
                  onCancelSession?.(isSessionMode, sessionHasLogged);
                  setLibraryVisible(false);
                  setSearchQuery('');
                  setActiveFilter('All');
                  setSwapState(null);
                }}
                className="session-cancel-button"
              >
                {isSessionMode ? 'Cancel workout' : 'Cancel draft'}
              </button>
            </div>
            {sessionEntries.length === 0 ? (
              <div className="text-xs workout-muted">Workout ready. Add exercises to get started.</div>
            ) : (
              <div className="space-y-2">
                {sessionEntries.map((entry, idx) => {
                  const entryId = entry.exerciseId || entry.id;
                  const entrySetCount = (sessionLogsByExercise[entryId] || []).length;
                  const categoryClass = colorfulExerciseCards ? resolveCategoryClass(entry.muscleGroup || EQUIPMENT_DB[entryId]?.target || '') : '';
                  return (
                  <div
                    key={entryId}
                    onClick={mode === 'active' ? () => onSelectExercise(entryId, 'session') : undefined}
                    className={`session-entry-row ${categoryClass}`}
                    role={mode === 'active' ? 'button' : undefined}
                    tabIndex={mode === 'active' ? 0 : undefined}
                    onKeyDown={mode === 'active' ? (e) => { if (e.key === 'Enter') onSelectExercise(entryId, 'session'); } : undefined}
                    style={{ cursor: mode === 'active' ? 'pointer' : 'default' }}
                  >
                    <div>
                      <div className="text-sm font-bold workout-heading">{entry.name || entry.label}</div>
                      <div className="text-[11px] workout-muted">{entry.kind === 'cardio' ? 'Cardio' : (entry.muscleGroup || 'Strength')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(mode === 'active' || entrySetCount > 0) && (
                        <div className={mode === 'draft' ? 'text-[11px] font-semibold workout-muted' : 'text-xs font-bold cues-accent'}>
                          {entrySetCount} {entry.kind === 'cardio' ? 'entries' : 'sets'}
                        </div>
                      )}
                      {mode === 'active' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectExercise(entryId, 'session'); }}
                          className="session-action-button"
                        >
                          + {entry.kind === 'cardio' ? 'Entry' : 'Set'}
                        </button>
                      )}
                      {entry.kind !== 'cardio' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSwapState({ mode: 'session', index: idx }); }}
                          className="session-action-button"
                        >
                          Swap
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveSessionExercise?.(entryId); }}
                        className="session-remove-button"
                        aria-label={`Remove ${entry.name || entry.label}`}
                      >
                        <Icon name="Trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={() => searchInputRef.current?.focus()}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm font-bold bg-white text-gray-900 active:scale-[0.98]"
              >
                + Add exercise
              </button>
              {isDraft && (
                <button
                  onClick={() => {
                    if (libraryVisible) setLibraryVisible(false);
                    if (showCompactSearch) setShowCompactSearch(false);
                    if (searchQuery) setSearchQuery('');
                    setActiveFilter('All');
                    onStartWorkoutFromBuilder?.();
                  }}
                  className="w-full py-3 rounded-xl font-bold active:scale-[0.98] accent-button"
                >
                  Start Workout
                </button>
              )}
            </div>
          </Card>
        )}

        {!isRestDay && !isSessionMode && (isDraft || libraryVisible || searchQuery) && (
          <>
            {filteredRecents.length > 0 && (
              <Card className="space-y-2 workout-card">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold workout-muted uppercase">Recent</div>
                </div>
                <div className="space-y-2">
                  {filteredRecents.map(id => renderExerciseRow(id, 'Add'))}
                </div>
              </Card>
            )}
          </>
        )}

        {libraryVisible && !isRestDay && (
          <Card className="space-y-2 workout-card">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold workout-muted uppercase">Full Library</div>
              <button onClick={() => setLibraryVisible(false)} className="text-xs cues-accent font-bold">Close</button>
            </div>
            <div className="filter-chip-row no-scrollbar">
              {filterOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setActiveFilter(option)}
                  className={`filter-chip ${activeFilter === option ? 'active' : ''}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="exercise-grid">
              {filteredPool.map(id => renderExerciseTile(id))}
            </div>
          </Card>
        )}

      </div>

      {isSessionMode && (
        <div className="finish-footer">
          <div className="finish-bar">
            <div className="finish-summary text-sm font-semibold text-gray-600">
              {finishSummaryText}
            </div>
            <button
              onClick={onFinishSession}
              className="finish-button accent-button w-auto py-3 px-5 rounded-2xl font-bold shadow-lg active:scale-[0.98]"
            >
              Finish Workout
            </button>
          </div>
        </div>
      )}

      {swapState !== null && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-end justify-center" onClick={() => setSwapState(null)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-4 animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">Swap Exercise</h3>
              <button onClick={() => setSwapState(null)} className="p-2 rounded-full bg-gray-100 text-gray-600">
                <Icon name="X" className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {swapOptions.map(id => (
                <button
                  key={id}
                  onClick={() => {
                    if (swapState?.mode === 'session') {
                      onSwapSessionExercise?.(swapState.index, id);
                    }
                    setSwapState(null);
                  }}
                  className="w-full p-3 rounded-xl border border-gray-200 text-left bg-gray-50 active:scale-[0.98]"
                >
                  <div className="font-bold text-gray-900 text-sm">{EQUIPMENT_DB[id]?.name}</div>
                  <div className="text-xs text-gray-500">{EQUIPMENT_DB[id]?.target}</div>
                </button>
              ))}
              {swapOptions.length === 0 && (
                <div className="text-sm text-gray-500">No similar exercises available.</div>
              )}
            </div>
          </div>
        </div>
      )}
      <TemplatePicker
        isOpen={isTemplatePickerOpen}
        plans={templatePlans}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={(plan) => {
          onApplyTemplate?.(plan);
          setIsTemplatePickerOpen(false);
        }}
      />
    </div>
  );
};
const PlateCalculator = ({ targetWeight, barWeight, onClose }) => {
      const [displayWeight, setDisplayWeight] = useState(targetWeight || barWeight || '');
      
      const plates = [45, 35, 25, 10, 5, 2.5];
      
      const calculatePlates = (weight) => {
        const w = Number(weight) || 0;
        const weightPerSide = (w - barWeight) / 2;
        if (weightPerSide <= 0) return [];
        
        const result = [];
        let remaining = weightPerSide;
        
        for (const plate of plates) {
          while (remaining >= plate) {
            result.push(plate);
            remaining -= plate;
          }
        }
        
        return result;
      };
      
      const platesToLoad = calculatePlates(displayWeight);
      const actualWeight = barWeight + (platesToLoad.reduce((sum, p) => sum + p, 0) * 2);
      
      return (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[100] animate-slide-up" onClick={onClose}>
          <div className="bg-white dark-mode-modal rounded-t-3xl w-full max-w-lg p-6 pb-8" style={{ maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Plate Calculator</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <Icon name="X" className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Target Weight</label>
              <input
                type="number"
                value={displayWeight}
                onChange={(e) => setDisplayWeight(e.target.value)}
                placeholder="Enter weight"
                className="w-full text-2xl font-bold text-center p-4 border-2 workout-accent-border rounded-xl workout-accent-focus outline-none bg-white text-gray-900 dark-mode-input"
              />
              <div className="text-center text-xs text-gray-500 mt-2">Bar weight: {barWeight} lbs</div>
            </div>
            
            {platesToLoad.length > 0 ? (
              <>
                <div className="workout-accent-surface rounded-xl p-4 mb-4">
                  <div className="text-center mb-3">
                    <div className="text-sm font-semibold workout-accent-text">Actual Weight</div>
                    <div className="text-3xl font-black workout-accent-text">{actualWeight} lbs</div>
                  </div>
                  
                  <div className="flex justify-center items-center gap-2 my-6">
                    <div className="text-xs text-gray-500 transform -rotate-90 whitespace-nowrap">Each Side</div>
                    <div className="flex flex-col gap-1">
                      {platesToLoad.map((plate, i) => (
                        <div
                          key={i}
                          className="workout-accent-solid rounded px-3 py-2 text-center font-bold text-sm"
                          style={{ width: `${60 + plate}px` }}
                        >
                          {plate}
                        </div>
                      ))}
                    </div>
                    <div className="w-16 h-3 bg-gray-800 rounded"></div>
                  </div>
                  
                  <div className="text-center text-xs text-gray-600">
                    Put these plates on <span className="font-bold">each side</span> of the bar
                  </div>
                </div>
                
                <div className="grid grid-cols-6 gap-2">
                  {plates.map(p => {
                    const count = platesToLoad.filter(plate => plate === p).length;
                    return (
                      <div key={p} className={`text-center p-2 rounded-lg border ${
                        count > 0 ? 'workout-accent-surface' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="text-xs font-bold text-gray-900">{p}</div>
                        {count > 0 && <div className="text-xs workout-accent-text">×{count}</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏋️</div>
                <div className="text-sm">Just the bar ({barWeight} lbs)</div>
              </div>
            )}
          </div>
        </div>
      );
    };

    // ========== EQUIPMENT DETAIL ==========
    const EquipmentDetail = ({ id, profile, history, settings, onSave, onClose, onUpdateSessionLogs, sessionLogs, onRequestUndo, onShowToast, autoFocusInput, onAutoFocusComplete }) => {
      const eq = EQUIPMENT_DB[id];
      const sessions = history || [];
      const insightsEnabled = settings?.insightsEnabled !== false;
      const [activeTab, setActiveTab] = useState('workout');
      const [showLogger, setShowLogger] = useState(true);
      const [showPlateCalc, setShowPlateCalc] = useState(false);
      const [anchorWeight, setAnchorWeight] = useState('');
      const [anchorReps, setAnchorReps] = useState('');
      const [anchorAdjusted, setAnchorAdjusted] = useState(false);
      const [loggedSets, setLoggedSets] = useState([]);
      const [setInputs, setSetInputs] = useState({ weight: '', reps: '' });
      const [editingIndex, setEditingIndex] = useState(null);
      const [editValues, setEditValues] = useState({ weight: '', reps: '' });
      const [baselineInputs, setBaselineInputs] = useState({ weight: '', reps: '' });
      const [baselineConfirmed, setBaselineConfirmed] = useState(sessions.length > 0);
      const [note, setNote] = useState('');
      const [isAddingSet, setIsAddingSet] = useState(false);
      const savedRef = useRef(false);
      const latestDraftRef = useRef({ loggedSets: [], anchorWeight: '', anchorReps: '', anchorAdjusted: false, note: '' });
      const lastSetSubmitRef = useRef({ key: '', at: 0 });
      const weightInputRef = useRef(null);
      const repsInputRef = useRef(null);
      const onSaveRef = useRef(onSave);

      const best = useMemo(() => getBestForEquipment(sessions), [sessions]);
      const nextTarget = useMemo(() => getNextTarget(profile, id, best), [profile, id, best]);
      const sessionNumber = sessions.length + 1;

      const deriveSessionAnchor = (session) => {
        if (!session) return { weight: null, reps: null };
        const weights = safeArray(session.sets).map(s => s.weight || 0).filter(Boolean);
        const reps = safeArray(session.sets).map(s => s.reps || 0).filter(Boolean);
        return {
          weight: session.anchorWeight || (weights.length ? Math.max(...weights) : null),
          reps: session.anchorReps || (reps.length ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : null)
        };
      };

      const baselineFromHistory = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;
        const first = sessions[0];
        const anchor = deriveSessionAnchor(first);
        if (first?.baselineWeight && first?.baselineReps) {
          return { weight: first.baselineWeight, reps: first.baselineReps };
        }
        if (anchor.weight && anchor.reps) return { weight: anchor.weight, reps: anchor.reps };
        return null;
      }, [sessions]);

      const recentAnchor = useMemo(() => {
        const recent = (sessions || []).slice(-3);
        if (recent.length === 0) return { weight: null, reps: null };
        const weights = recent.map(s => deriveSessionAnchor(s).weight).filter(Boolean);
        const reps = recent.map(s => deriveSessionAnchor(s).reps).filter(Boolean);
        return {
          weight: weights.length ? Math.max(...weights) : null,
          reps: reps.length ? Math.round(reps.sort((a,b) => a-b)[Math.floor(reps.length/2)]) : null
        };
      }, [sessions]);

      const lastSession = sessions[sessions.length - 1];
      const lastSessionSummary = useMemo(() => {
        if (!insightsEnabled || !lastSession || !lastSession.sets?.length) return null;
        const lastSet = lastSession.sets[lastSession.sets.length - 1];
        if (!lastSet?.weight || !lastSet?.reps) return null;
        return `${lastSet.weight} lb × ${lastSet.reps} reps`;
      }, [insightsEnabled, lastSession]);
      const defaultAnchor = useMemo(() => {
        const anchor = deriveSessionAnchor(lastSession);
        if (anchor.weight && anchor.reps) return anchor;
        if (baselineFromHistory) return baselineFromHistory;
        return { weight: null, reps: null };
      }, [lastSession, baselineFromHistory]);

      useEffect(() => {
        const weight = defaultAnchor.weight ? String(defaultAnchor.weight) : '';
        const reps = defaultAnchor.reps ? String(defaultAnchor.reps) : '';
        setAnchorWeight(weight);
        setAnchorReps(reps);
        setAnchorAdjusted(false);
        setNote('');
        setSetInputs({ weight: '', reps: '' });
        setBaselineInputs({
          weight: baselineFromHistory?.weight ? String(baselineFromHistory.weight) : '',
          reps: baselineFromHistory?.reps ? String(baselineFromHistory.reps) : ''
        });
        setBaselineConfirmed(sessions.length > 0);
        savedRef.current = false;
      }, [id, defaultAnchor, baselineFromHistory, sessions.length]);

      useEffect(() => {
        setLoggedSets(sessionLogs || []);
      }, [sessionLogs]);

      useEffect(() => {
        setSetInputs(prev => ({
          weight: prev.weight || (anchorWeight || ''),
          reps: prev.reps || (anchorReps || '')
        }));
      }, [anchorWeight, anchorReps]);

      useEffect(() => {
        if (!autoFocusInput) return;
        const shouldFocusReps = Boolean(setInputs.weight || anchorWeight);
        requestAnimationFrame(() => {
          const target = shouldFocusReps ? repsInputRef.current : weightInputRef.current;
          (target || weightInputRef.current || repsInputRef.current)?.focus();
          onAutoFocusComplete?.();
        });
      }, [autoFocusInput, anchorWeight, onAutoFocusComplete, setInputs.weight]);

      const syncSessionSets = (nextSets) => {
        if (onUpdateSessionLogs) {
          onUpdateSessionLogs(id, nextSets);
        }
      };

      const handleQuickAddSet = () => {
        const w = Number(setInputs.weight);
        const r = Number(setInputs.reps);
        if (!w || !r || w <= 0 || r <= 0) return;
        if (isAddingSet) return;
        const now = Date.now();
        const key = `${w}-${r}`;
        if (lastSetSubmitRef.current.key === key && now - lastSetSubmitRef.current.at < 900) return;
        lastSetSubmitRef.current = { key, at: now };
        setIsAddingSet(true);
        setLoggedSets(prev => {
          const next = [...prev, { weight: w, reps: r }];
          syncSessionSets(next);
          return next;
        });
        const nextWeight = String(w);
        const nextReps = String(r);
        setAnchorWeight(nextWeight);
        setAnchorReps(nextReps);
        setAnchorAdjusted(true);
        setSetInputs({ weight: nextWeight, reps: nextReps });
        const shouldFocusReps = Boolean(nextWeight);
        requestAnimationFrame(() => {
          const target = shouldFocusReps ? repsInputRef.current : weightInputRef.current;
          (target || weightInputRef.current || repsInputRef.current)?.focus();
        });
        setTimeout(() => setIsAddingSet(false), 300);
        setEditingIndex(null);
        onShowToast?.('Set saved');
      };

      const startEditSet = (idx) => {
        const target = loggedSets[idx];
        if (!target) return;
        setEditingIndex(idx);
        setEditValues({ weight: String(target.weight || ''), reps: String(target.reps || '') });
      };

      const saveEditedSet = () => {
        const w = Number(editValues.weight);
        const r = Number(editValues.reps);
        if (!w || !r || w <= 0 || r <= 0 || editingIndex === null) return;
        setLoggedSets(prev => {
          const next = prev.map((set, idx) => idx === editingIndex ? { weight: w, reps: r } : set);
          syncSessionSets(next);
          return next;
        });
        setEditingIndex(null);
        onShowToast?.('Set saved');
      };

      const deleteSet = (idx) => {
        const removed = loggedSets[idx];
        if (!removed) return;
        const next = loggedSets.filter((_, i) => i !== idx);
        setLoggedSets(next);
        syncSessionSets(next);
        setEditingIndex(null);
        onRequestUndo?.({
          message: 'Removed.',
          onUndo: () => {
            setLoggedSets(prev => {
              const restored = [...prev];
              const insertAt = Math.min(idx, restored.length);
              restored.splice(insertAt, 0, removed);
              syncSessionSets(restored);
              return restored;
            });
          }
        });
      };

      const buildSessionPayload = (draft) => {
        const source = draft || { loggedSets, anchorWeight, anchorReps, anchorAdjusted, note };
        const sets = source.loggedSets || [];
        if (sets.length === 0) return null;
        const basePayload = {
          date: new Date().toISOString(),
          type: 'strength',
          sets,
          anchorWeight: Number(source.anchorWeight),
          anchorReps: Number(source.anchorReps),
          adjustedToday: source.anchorAdjusted || false,
          note: source.note || undefined
        };
        if (sessions.length === 0) {
          return {
            ...basePayload,
            baselineWeight: Number(source.anchorWeight),
            baselineReps: Number(source.anchorReps)
          };
        }
        return basePayload;
      };

      const handleSaveSession = () => {
        const payload = buildSessionPayload();
        if (payload) {
          onSave(id, payload);
          savedRef.current = true;
          return true;
        }
        return false;
      };

      useEffect(() => {
        latestDraftRef.current = { loggedSets, anchorWeight, anchorReps, anchorAdjusted, note };
      }, [loggedSets, anchorWeight, anchorReps, anchorAdjusted, note]);

      // Keep onSaveRef in sync with latest onSave prop
      useEffect(() => {
        onSaveRef.current = onSave;
      }, [onSave]);

      // Cleanup effect - only runs on unmount, uses refs to avoid stale closures
      useEffect(() => {
        return () => {
          if (!savedRef.current) {
            const payload = buildSessionPayload(latestDraftRef.current);
            if (payload && onSaveRef.current) {
              // Pass keepOpen: true to prevent closing modal during auto-save cleanup
              // The modal will be closed by onClose() separately if user initiated close
              onSaveRef.current(id, payload, { quiet: true, keepOpen: true });
              savedRef.current = true;
            }
          }
        };
      }, [id]);

      const handleClose = () => {
        handleSaveSession();
        onClose();
      };

      const isBaselineMode = sessions.length === 0 && !baselineConfirmed;

      const weightBump = (w) => {
        if (!w) return 5;
        if (w < 50) return 2.5;
        if (w < 120) return 5;
        return 10;
      };

      const overloadSuggestion = useMemo(() => {
        if (sessions.length < 2) return null;
        const numericAnchorWeight = Number(anchorWeight) || Number(baselineInputs.weight);
        const numericAnchorReps = Number(anchorReps) || Number(baselineInputs.reps);
        const baseWeight = recentAnchor.weight || numericAnchorWeight;
        const baseReps = recentAnchor.reps || numericAnchorReps;
        if (!baseWeight || !baseReps) return null;
        const bump = weightBump(baseWeight);
        return {
          nextWeight: clampTo5(baseWeight + bump),
          reps: baseReps,
          rationale: `${sessions.length >= 2 ? '2 consistent sessions' : 'Recent consistency'} → try +${bump} lb`
        };
      }, [sessions.length, anchorWeight, anchorReps, baselineInputs, recentAnchor]);

      const handleConfirmBaseline = () => {
        const w = Number(baselineInputs.weight);
        const r = Number(baselineInputs.reps);
        if (!w || !r || w <= 0 || r <= 0) return;
        setAnchorWeight(String(w));
        setAnchorReps(String(r));
        setBaselineConfirmed(true);
        setAnchorAdjusted(false);
      };

      const getPlateLoadingForSet = (weight) => {
        if (eq.type !== 'barbell' || !weight) return null;
        return calculatePlateLoading(Number(weight), profile.barWeight || 45);
      };

      return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark-mode-modal w-full max-w-md rounded-t-3xl shadow-2xl flex flex-col animate-slide-up" style={{maxHeight: '90vh'}}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-3xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 transition-colors">
                  <Icon name="ChevronLeft" className="w-6 h-6"/>
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{eq.name}</h2>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {eq.type === 'machine' ? '⚙️' : eq.type === 'dumbbell' ? '🏋️' : '🏋️‍♂️'} {eq.muscles}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <Icon name="X" className="w-5 h-5"/>
              </button>
            </div>

            <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
              <button
                onClick={() => setActiveTab('workout')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  activeTab === 'workout' ? 'workout-accent-text border-b-2 workout-accent-border' : 'text-gray-400'
                }`}
              >
                Log
              </button>
              {insightsEnabled && (<button
                onClick={() => setActiveTab('cues')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  activeTab === 'cues' ? 'workout-accent-text border-b-2 workout-accent-border' : 'text-gray-400'
                }`}
              >
                Cues & Info
              </button>)}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ minHeight: '500px', maxHeight: '500px' }}>
              <div className="p-5 space-y-5 h-full">
                {activeTab === 'workout' ? (
                  <>
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setShowLogger(!showLogger)}
                        className="w-full p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="Trophy" className="w-5 h-5 workout-accent-text"/>
                          <h3 className="text-xs font-black uppercase text-gray-900">Log Today</h3>
                        </div>
                        <Icon name="ChevronDown" className={`w-5 h-5 text-gray-600 transition-transform ${showLogger ? 'rotate-180' : ''}`}/>
                      </button>

                      {showLogger && (
                        <div className="px-4 pb-4 space-y-3 animate-expand">
                          {isBaselineMode && (
                            <div className="p-3 rounded-2xl baseline-card space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">🧭</div>
                                <div className="flex-1">
                                  <div className="text-[10px] font-black uppercase baseline-accent">Set your starting point</div>
                                  <p className="text-sm baseline-primary font-semibold leading-relaxed">
                                    Set a weight and reps to begin. You can change these anytime.
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={baselineInputs.weight}
                                  onChange={(e) => setBaselineInputs(prev => ({ ...prev, weight: e.target.value }))}
                                  placeholder="lbs"
                                  className="w-full p-3 rounded-xl baseline-input font-black text-center workout-accent-focus outline-none"
                                />
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={baselineInputs.reps}
                                  onChange={(e) => setBaselineInputs(prev => ({ ...prev, reps: e.target.value }))}
                                  placeholder="reps"
                                  className="w-full p-3 rounded-xl baseline-input font-black text-center workout-accent-focus outline-none"
                                />
                              </div>
                              <button
                                onClick={handleConfirmBaseline}
                                disabled={!baselineInputs.weight || !baselineInputs.reps}
                                className={`w-full py-3 rounded-xl font-black transition-all active:scale-95 baseline-button ${
                                  baselineInputs.weight && baselineInputs.reps ? 'baseline-button--active' : 'baseline-button--disabled'
                                }`}
                              >
                                Set baseline & start logging
                              </button>
                            </div>
                          )}

                          {!isBaselineMode && (
                            <>
                              <div className="p-3 rounded-2xl workout-accent-surface space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-[10px] font-black uppercase workout-accent-text">Anchored weight</div>
                                    <div className="text-base font-black text-gray-900">
                                      {anchorWeight && anchorReps ? `${anchorWeight} lb × ${anchorReps} reps` : 'Set your anchor'}
                                    </div>
                                    {anchorAdjusted && <div className="text-[11px] workout-accent-text font-semibold">Adjusted today</div>}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                                  <span>Sets completed: {loggedSets.length}</span>
                                  {anchorWeight && anchorReps && (
                                    <span className="text-[11px] workout-accent-text font-bold">Using: {anchorWeight} lb × {anchorReps} reps</span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={setInputs.weight}
                                    onChange={(e) => setSetInputs(prev => ({ ...prev, weight: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        repsInputRef.current?.focus();
                                      }
                                    }}
                                    placeholder="Weight"
                                    ref={weightInputRef}
                                    className="w-full p-3 rounded-xl border-2 workout-accent-border bg-white font-black text-center text-gray-900 workout-accent-focus outline-none"
                                  />
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={setInputs.reps}
                                    onChange={(e) => setSetInputs(prev => ({ ...prev, reps: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleQuickAddSet();
                                      }
                                    }}
                                    placeholder="Reps"
                                    ref={repsInputRef}
                                    className="w-full p-3 rounded-xl border-2 workout-accent-border bg-white font-black text-center text-gray-900 workout-accent-focus outline-none"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleQuickAddSet();
                                  }}
                                  disabled={!setInputs.weight || !setInputs.reps || isBaselineMode || isAddingSet}
                                  className={`w-full py-3 rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                    (!setInputs.weight || !setInputs.reps || isBaselineMode || isAddingSet) ? 'workout-accent-disabled cursor-not-allowed' : 'workout-accent-solid shadow-lg'
                                  }`}
                                >
                                  <span className="text-lg">＋</span>
                                  {isAddingSet ? 'Adding...' : 'Add Set'}
                                </button>

                                <div className="text-[10px] workout-accent-muted font-semibold">
                                  
                                </div>
                              </div>
                              {eq.type === 'barbell' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPlateCalc(true);
                                  }}
                                  className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-white workout-accent-text border workout-accent-border active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  🏋️ Plate Calculator
                                </button>
                              )}

                              <div className="p-3 rounded-2xl bg-white border border-gray-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] font-black uppercase text-gray-500">Logged sets</div>
                                  {loggedSets.length > 0 && (
                                    <div className="text-[11px] workout-accent-text font-semibold">{loggedSets.length} sets</div>
                                  )}
                                </div>
                                {loggedSets.length === 0 ? (
                                  <div className="text-sm text-gray-500">{COPY_LOGGER.noSetsYet}</div>
                                ) : (
                                  <div className="space-y-2">
                                    {loggedSets.map((s, idx) => (
                                      <div
                                        key={idx}
                                        className={`p-3 rounded-xl border ${editingIndex === idx ? 'workout-accent-border workout-accent-surface' : 'border-gray-100 bg-gray-50'} flex items-center justify-between gap-3`}
                                      >
                                        {editingIndex === idx ? (
                                          <div className="flex-1 grid grid-cols-2 gap-2">
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              value={editValues.weight}
                                              onChange={(e) => setEditValues(prev => ({ ...prev, weight: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  saveEditedSet();
                                                }
                                              }}
                                              className="w-full p-2 rounded-lg border-2 workout-accent-border bg-white font-bold text-center text-gray-900 workout-accent-focus outline-none"
                                            />
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              value={editValues.reps}
                                              onChange={(e) => setEditValues(prev => ({ ...prev, reps: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  saveEditedSet();
                                                }
                                              }}
                                              className="w-full p-2 rounded-lg border-2 workout-accent-border bg-white font-bold text-center text-gray-900 workout-accent-focus outline-none"
                                            />
                                            <button
                                              onClick={saveEditedSet}
                                              className="col-span-2 py-2 rounded-lg workout-accent-solid font-bold active:scale-95"
                                            >
                                              Save
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex-1 cursor-pointer" onClick={() => startEditSet(idx)}>
                                            <div className="text-xs font-black text-gray-900">Set {idx + 1}</div>
                                            <div className="text-sm font-semibold text-gray-800">{s.weight} lb × {s.reps} reps</div>
                                          </div>
                                        )}
                                        {editingIndex === idx ? (
                                          <button
                                            onClick={() => setEditingIndex(null)}
                                            className="text-gray-500 text-sm font-semibold px-2 py-1"
                                          >
                                            Cancel
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => startEditSet(idx)}
                                              className="px-3 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 active:scale-95"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => deleteSet(idx)}
                                              className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-600 active:scale-95"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="p-3 rounded-2xl bg-white border border-gray-100">
                                <button
                                  onClick={handleClose}
                                  className="w-full px-4 py-3 rounded-xl workout-accent-solid font-bold text-sm uppercase tracking-widest active:scale-95"
                                >
                                  {COPY_LOGGER.finishCta}
                                </button>
                              </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="cues-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="Target" className="w-5 h-5 cues-accent"/>
                          <h3 className="text-xs font-black uppercase cues-title">Progressive Overload</h3>
                        </div>
                        {overloadSuggestion ? (
                          <div className="space-y-1">
                            <div className="text-sm font-black cues-title">Suggested next: {overloadSuggestion.nextWeight} lb × {overloadSuggestion.reps}</div>
                            <div className="text-xs cues-muted">Why: {overloadSuggestion.rationale}</div>
                            <div className="text-[11px] cues-muted font-semibold">Suggestions stay optional—log what really happened.</div>
                          </div>
                        ) : (
                          <div className="text-sm cues-muted">Complete 2 sessions to unlock a suggestion.</div>
                        )}
                      </div>

                      <div className="cues-card">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="Check" className="w-5 h-5 cues-accent"/>
                          <h3 className="text-xs font-black uppercase cues-title">Form Cues</h3>
                        </div>
                        <ul className="space-y-2">
                          {eq.cues.map((cue, i) => (
                            <li key={i} className="flex gap-2 text-sm cues-title">
                              <span className="cues-accent font-bold">•</span>
                              <span>{cue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="cues-card">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="Info" className="w-5 h-5 cues-accent"/>
                          <h3 className="text-xs font-black uppercase cues-title">Progression notes</h3>
                        </div>
                        <p className="text-sm cues-muted leading-relaxed">{eq.progression}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {showPlateCalc && (
            <PlateCalculator
              targetWeight={nextTarget}
              barWeight={profile.barWeight || 45}
              onClose={() => setShowPlateCalc(false)}
            />
          )}
        </div>
      );
    };

    // ========== PROGRESS TAB ==========
    const Progress = ({
      profile,
      history,
      strengthScoreObj,
      cardioHistory,
      initialAnalyticsTab = 'overview'
    }) => {
      const [selectedEquipment, setSelectedEquipment] = useState(null);
      const [analyticsTab, setAnalyticsTab] = useState(initialAnalyticsTab);
      const [exerciseHistoryQuery, setExerciseHistoryQuery] = useState('');
      const [exerciseHistoryExpanded, setExerciseHistoryExpanded] = useState(null);
      useEffect(() => {
        if (initialAnalyticsTab && initialAnalyticsTab !== analyticsTab) {
          setAnalyticsTab(initialAnalyticsTab);
          setSelectedEquipment(null);
        }
      }, [initialAnalyticsTab]);

      const allEquipment = Object.keys(EQUIPMENT_DB).filter(id => EQUIPMENT_DB[id]?.type !== 'cardio');
      const combinedSessions = useMemo(() => {
        const sessions = [];
        const seen = new Set();
        Object.entries(history || {}).forEach(([equipId, arr]) => {
          safeArray(arr).forEach(s => {
            if (!s || typeof s !== 'object') return;
            const cardioType = s.type === 'cardio' ? (s.cardioType || equipId.replace('cardio_', '')) : null;
            const cardioLabel = s.type === 'cardio' ? (s.cardioLabel || EQUIPMENT_DB[equipId]?.name || 'Cardio') : null;
            const id = s.type === 'cardio'
              ? `${s.date}-${cardioType}-cardio`
              : `${s.date}-${equipId}-strength`;
            if (seen.has(id)) return;
            seen.add(id);
            sessions.push({ ...s, equipId, cardioType: cardioType || s.cardioType, cardioLabel, type: s.type || 'strength' });
          });
        });
        Object.entries(cardioHistory || {}).forEach(([cardioType, arr]) => {
          safeArray(arr).forEach(s => {
            if (!s || typeof s !== 'object') return;
            const id = `${s.date}-${s.cardioType || cardioType}-cardio`;
            if (seen.has(id)) return;
            seen.add(id);
            sessions.push({ ...s, cardioType: s.cardioType || cardioType, type: 'cardio' });
          });
        });
        return sessions;
      }, [history, cardioHistory]);

      const equipmentWithHistory = allEquipment.filter(id => safeArray(history[id]).length > 0).length;

      const MiniChart = ({ equipId }) => {
        const sessions = safeArray(history[equipId]);
        if (sessions.length < 2) return <p className="text-sm text-gray-400 text-center py-8">Log at least 2 sessions to chart progress</p>;

        const dataPoints = sessions.map(s => {
          let maxWeight = 0;
          safeArray(s.sets).forEach(set => { if (set.weight > maxWeight) maxWeight = set.weight; });
          return { date: new Date(s.date), weight: maxWeight };
        }).filter(d => d.weight > 0).slice(-10);

        if (dataPoints.length < 2) return <p className="text-sm text-gray-400 text-center py-8">Need more data points</p>;

        const weights = dataPoints.map(d => d.weight);
        const minW = Math.min(...weights) - 10;
        const maxW = Math.max(...weights) + 10;
        const range = (maxW - minW) || 1;

        const width = 280, height = 120, padding = 20;
        const points = dataPoints.map((d, i) => {
          const x = padding + (i / (dataPoints.length - 1)) * (width - padding * 2);
          const y = height - padding - ((d.weight - minW) / range) * (height - padding * 2);
          return { x, y };
        });
        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        return (
          <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent-hover)" />
                </linearGradient>
              </defs>
              <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke="var(--accent)" strokeWidth="2" />
              ))}
            </svg>
            <div className="flex justify-between items-center mt-2 text-[11px] text-gray-500 font-semibold">
              <span>Recent trend</span>
              <span>Last {dataPoints.length} sessions</span>
            </div>
          </div>
        );
      };

      return (
        <div className="flex flex-col h-full bg-gray-50 analytics-shell">
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="p-4">
              <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
              <div className="text-xs text-gray-500 font-bold">Your strength journey</div>
            </div>
            
            <div className="flex gap-2 px-4 pb-3">
              <button
                onClick={() => {
                  setSelectedEquipment(null);
                  setAnalyticsTab('overview');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  analyticsTab === 'overview' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setSelectedEquipment(null);
                  setAnalyticsTab('history');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  analyticsTab === 'history' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                }`}
              >
                History
              </button>
              <button
                onClick={() => {
                  setSelectedEquipment(null);
                  setAnalyticsTab('exercise');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  analyticsTab === 'exercise' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Exercise History
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
            {analyticsTab === 'history' ? (
              <>
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">Workout History</h3>
                    <Icon name="Clock" className="w-4 h-4 text-gray-400" />
                  </div>
                  {(() => {
                    const sortedSessions = [...combinedSessions].sort((a, b) => new Date(b.date) - new Date(a.date));
                    
                    if (sortedSessions.length === 0) {
                      return (
                        <div className="empty-state-card card-enter">
                          <div className="empty-state-title">No workouts yet</div>
                          <div className="empty-state-text">Log a few sessions and we’ll start showing your trends here.</div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-2">
                        {sortedSessions.map((session, idx) => {
                          const isCardio = session.type === 'cardio';
                          const eq = EQUIPMENT_DB[session.equipId];
                          const sets = isCardio ? 0 : safeArray(session.sets).length;
                          const cardioLabel = isCardio ? (session.cardioLabel || eq?.name || 'Cardio') : null;
                          const durationLabel = isCardio ? (session.duration ? `${session.duration} min` : `${safeArray(session.entries).length} entries`) : null;
                          const categoryClass = isCardio ? '' : resolveCategoryClass(eq?.target || '');

                          return (
                            <div key={idx} className={`p-3 bg-gray-50 rounded-lg border border-gray-100 ${categoryClass}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="text-xl">{isCardio ? (eq?.emoji || '🏃') : eq?.type === 'machine' ? '⚙️' : eq?.type === 'dumbbell' ? '🏋️' : '🏋️‍♂️'}</div>
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">{cardioLabel || eq?.name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                </div>
                                {isCardio ? (
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-purple-600">{durationLabel}</div>
                                  </div>
                                ) : (
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-purple-600">{sets} sets</div>
                                    <div className="text-xs text-gray-500">Strength logged</div>
                                  </div>
                                )}
                              </div>
                              
                              {isCardio ? (
                                <div className="text-xs text-gray-600">
                                  {safeArray(session.entries).slice(0, 2).map((entry, i) => {
                                    const entryDuration = entry.durationMin || entry.minutes;
                                    const durationLabel = entryDuration ? `${entryDuration} min` : 'Time logged';
                                    const entryUnit = entry.distanceUnit || (entry.poolType === '25m' || entry.poolType === '50m' ? 'm' : entry.poolType === '25yd' ? 'yd' : '');
                                    const unitLabel = entryUnit ? ` ${entryUnit}` : '';
                                    return (
                                      <div key={i} className="text-gray-500">
                                        {durationLabel}{entry.distance ? ` • ${entry.distance}${unitLabel}` : ''}
                                      </div>
                                    );
                                  })}
                                  {safeArray(session.entries).length > 2 && (
                                    <div className="text-[11px] text-gray-400">+{session.entries.length - 2} more entries</div>
                                  )}
                                </div>
                              ) : (
                                <div className="grid grid-cols-4 gap-1 mt-2">
                                  {safeArray(session.sets).map((set, i) => (
                                    <div key={i} className="text-center p-1 bg-white rounded border border-gray-100">
                                      <div className="text-xs font-bold text-gray-900">{set.weight}</div>
                                      <div className="text-[10px] text-gray-500">×{set.reps}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Card>
              </>
            ) : analyticsTab === 'exercise' ? (
              <>
                <Card className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase">Exercise History</div>
                      <div className="text-sm text-gray-500">Tap to expand past sets.</div>
                    </div>
                    <Icon name="Search" className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    value={exerciseHistoryQuery}
                    onChange={(e) => setExerciseHistoryQuery(e.target.value)}
                    placeholder="Search exercises"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  />
                  {(() => {
                    const withHistory = allEquipment.filter(id => safeArray(history[id]).length > 0);
                    const filtered = withHistory.filter(id => (EQUIPMENT_DB[id]?.name || '').toLowerCase().includes(exerciseHistoryQuery.toLowerCase()));
                    if (filtered.length === 0) {
                      return <div className="text-sm text-gray-500 text-center py-4">No exercises match yet.</div>;
                    }
                    return (
                      <div className="exercise-history-grid">
                        {filtered.map(id => {
                          const eq = EQUIPMENT_DB[id];
                          const sessions = safeArray(history[id]).slice(-6).reverse();
                          const isExpanded = exerciseHistoryExpanded === id;
                          const categoryClass = resolveCategoryClass(eq?.target || '');
                          return (
                            <div key={id} className={`exercise-history-card ${categoryClass} ${isExpanded ? 'expanded' : ''}`}>
                              <button
                                onClick={() => setExerciseHistoryExpanded(isExpanded ? null : id)}
                                className="exercise-history-toggle"
                              >
                                <div>
                                  <div className="text-xs font-bold text-gray-900">{eq.name}</div>
                                  <div className="text-[10px] text-gray-500">{sessions.length} sessions</div>
                                </div>
                                <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} className="w-4 h-4 text-gray-400" />
                              </button>
                              {isExpanded && (
                                <div className="exercise-history-detail">
                                  {sessions.length === 0 ? (
                                    <div className="empty-state-card card-enter-delayed">
                                      <div className="empty-state-title">No sessions yet</div>
                                      <div className="empty-state-text">Once you’ve saved a few workouts, this section will show your overview.</div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {sessions.map((session, idx) => {
                                        const summary = safeArray(session.sets).map(set => `${set.reps}×${set.weight}`).join(', ');
                                        return (
                                          <div key={idx} className="p-2 rounded-lg border border-gray-200 bg-white">
                                            <div className="text-[11px] font-bold text-gray-900">
                                              {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-gray-500">{safeArray(session.sets).length} sets</div>
                                            <div className="text-[11px] text-gray-700">{summary || 'No sets logged.'}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-gray-400 mt-2">Videos coming later.</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Card>
              </>
            ) : !selectedEquipment ? (
              <>
                {/* Streak Card */}
                {(() => {
                  const streakObj = computeStreak(history, cardioHistory);
                  return (
                    <Card>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-400 font-bold uppercase">Current Streak</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Icon name="Flame" className="w-6 h-6 text-orange-500" />
                            <span className="text-3xl font-black text-gray-900">{streakObj.current}</span>
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400 font-semibold">Best</div>
                          <div className="text-2xl font-black text-purple-600">{streakObj.best}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })()}

                {/* Workout Summary Cards - Compact Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Score</div>
                    <div className="text-2xl font-black text-purple-600">{strengthScoreObj.score}</div>
                    <div className="text-[9px] text-gray-500">/ 100</div>
                  </Card>
                  
                  <Card className="p-3">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Tracked</div>
                    <div className="text-2xl font-black text-gray-900">{equipmentWithHistory}</div>
                    <div className="text-[9px] text-gray-500">/ {allEquipment.length}</div>
                  </Card>
                  
                  <Card className="p-3">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Avg</div>
                    <div className="text-2xl font-black text-gray-900">{strengthScoreObj.avgPct}%</div>
                    <div className="text-[9px] text-gray-500">strength</div>
                  </Card>
                </div>

                {/* Recent Workout History */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">Recent Workouts</h3>
                    <Icon name="Clock" className="w-4 h-4 text-gray-400" />
                  </div>
                  {(() => {
                    const recentSessions = [...combinedSessions]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 10);
                    
                    if (recentSessions.length === 0) {
                      return <p className="text-sm text-gray-500 text-center py-4">No workouts logged yet</p>;
                    }
                    
                    return (
                      <div className="space-y-2">
                        {recentSessions.map((session, idx) => {
                          const isCardio = session.type === 'cardio';
                          const eq = EQUIPMENT_DB[session.equipId];
                          const setCount = isCardio ? null : safeArray(session.sets).length;
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="text-lg">{isCardio ? (eq?.emoji || '🏃') : eq?.type === 'machine' ? '⚙️' : eq?.type === 'dumbbell' ? '🏋️' : '🏋️‍♂️'}</div>
                                <div>
                                  <div className="text-xs font-bold text-gray-900">{isCardio ? (session.cardioLabel || eq?.name || 'Cardio') : (eq?.name || 'Unknown')}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              </div>
                              {isCardio ? (
                                <div className="text-right">
                                  <div className="text-xs font-bold text-purple-600">{session.duration ? `${session.duration} min` : `${safeArray(session.entries).length} entries`}</div>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="text-xs font-bold text-purple-600">{setCount} sets</div>
                                  <div className="text-[10px] text-gray-500">Strength logged</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Card>

                {/* Exercise Progress List */}
                <Card>
                  <h3 className="font-bold text-gray-900 mb-3">Exercise Progress</h3>
                  <div className="space-y-2">
                    {allEquipment.filter(id => safeArray(history[id]).length > 0).slice(0, 5).map(id => {
                      const eq = EQUIPMENT_DB[id];
                      const sessions = safeArray(history[id]);
                      const sessionCount = sessions.length;
                      const bar = Math.min(100, Math.max(10, sessionCount * 12));
                      return (
                        <div key={id} onClick={() => { setSelectedEquipment(id); setAnalyticsTab('overview'); }} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:border-purple-200 transition-all">
                          <div className="flex items-center gap-2">
                            <div className="text-lg">{eq.type === 'cardio' ? (eq.emoji || '🏃') : eq.type === 'machine' ? '⚙️' : eq.type === 'dumbbell' ? '🏋️' : '🏋️‍♂️'}</div>
                            <div>
                              <div className="text-xs font-bold text-gray-900">{eq.name}</div>
                              <div className="text-[10px] text-gray-500">{sessionCount} sessions logged</div>
                            </div>
                          </div>
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${bar}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {equipmentWithHistory === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Start logging to track progress</p>
                  )}
                </Card>
              </>
            ) : (
              <Card>
                <button onClick={() => { setSelectedEquipment(null); setAnalyticsTab('overview'); }} className="flex items-center gap-2 mb-4 text-purple-600 font-semibold text-sm">
                  <Icon name="ChevronLeft" className="w-4 h-4" />
                  Back to Overview
                </button>
                
                {(() => {
                  const eq = EQUIPMENT_DB[selectedEquipment];
                  const sessions = safeArray(history[selectedEquipment]);
                  if (sessions.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-2">{eq.type === 'machine' ? '⚙️' : eq.type === 'dumbbell' ? '🏋️' : '🏋️‍♂️'}</div>
                        <h3 className="font-bold text-gray-900 mb-1">{eq.name}</h3>
                        <p className="text-sm text-gray-500">No sessions logged yet</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">{eq.name}</h3>
                      <MiniChart equipId={selectedEquipment} />
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>
        </div>
      );
    };

    // ========== PROFILE TAB ==========
    const ProfileView = ({ settings, setSettings, themeMode, darkVariant, setThemeMode, setDarkVariant, colorfulExerciseCards, onToggleColorfulExerciseCards, onViewAnalytics, onViewPatterns, onViewMuscleMap, onExportData, onImportData, onResetApp, onResetOnboarding, onBack }) => {
      const [workoutOpen, setWorkoutOpen] = useState(false);
      const [appearanceOpen, setAppearanceOpen] = useState(false);
      const [analyticsOpen, setAnalyticsOpen] = useState(false);
      const [learnOpen, setLearnOpen] = useState(false);
      const [aboutOpen, setAboutOpen] = useState(false);
      const [dataToolsOpen, setDataToolsOpen] = useState(false);
      const [advancedOpen, setAdvancedOpen] = useState(false);

      const accentOptions = [
        { id: 'red', label: 'Red', color: '#ef4444' },
        { id: 'yellow', label: 'Yellow', color: '#f59e0b' },
        { id: 'blue', label: 'Blue', color: '#3b82f6' },
      ];
      const isDarkMode = themeMode === 'dark';

      const learnItems = [
        {
          title: 'How Insights Work',
          body: 'Insights are based only on your own history. No demographics, no comparisons—just you vs. you.'
        },
        {
          title: 'Staying Consistent',
          body: 'Log a little each session. Consistency beats intensity.'
        },
        {
          title: 'Editing a Log',
          body: 'Tap a set to edit it, or delete if it was an off day.'
        }
      ];

      return (
        <div className="flex flex-col h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center gap-3 p-4 py-5">
              {onBack && (
                <button onClick={onBack} className="ps-back-btn" title="Back">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                </button>
              )}
              <h1 className="text-2xl font-black text-gray-900">Settings</h1>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
            <Card className="space-y-3">
              <button
                onClick={() => setAppearanceOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Appearance</div>
                  <div className="text-sm text-gray-500">Theme and accent</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
              </button>
              {appearanceOpen && (
                <div className="space-y-3 animate-expand">
                  <ToggleRow
                    icon="Moon"
                    title="Dark Mode"
                    subtitle="Low-glare interface"
                    enabled={isDarkMode}
                    onToggle={(next) => setThemeMode(next ? 'dark' : 'light')}
                  />
                  <ToggleRow
                    icon="Sparkles"
                    title="Colorful exercise cards"
                    subtitle="Show muscle group colors on exercise cards"
                    enabled={colorfulExerciseCards}
                    onToggle={onToggleColorfulExerciseCards}
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Dark mode accent</div>
                    <div className="flex gap-2">
                      {accentOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => isDarkMode && setDarkVariant(opt.id)}
                          disabled={!isDarkMode}
                          aria-disabled={!isDarkMode}
                          className={`flex-1 accent-pill ${isDarkMode && darkVariant === opt.id ? 'active' : ''} rounded-xl p-2 flex items-center gap-2 ${isDarkMode ? '' : 'opacity-50 pointer-events-none'}`}
                        >
                          <span className="w-6 h-6 rounded-lg" style={{ background: opt.color }}></span>
                          <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs font-bold text-gray-500 uppercase mt-3">Theme preview</div>
                    <div className="theme-preview">
                      <div className="preview-btn">Primary</div>
                      <div className="preview-chip">Chip</div>
                      <div className="preview-card">Card border</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button onClick={() => setWorkoutOpen(prev => !prev)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Workout logging preferences</div>
                  <div className="text-sm text-gray-500">Insights and default views</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${workoutOpen ? 'rotate-180' : ''}`} />
              </button>
              {workoutOpen && (
                <div className="space-y-3 animate-expand">
                  <ToggleRow
                    icon="TrendingUp"
                    title="Insights"
                    subtitle="Optional, based only on your history"
                    enabled={settings.insightsEnabled !== false}
                    onToggle={(next) => setSettings({ ...settings, insightsEnabled: next })}
                  />
                  <ToggleRow
                    icon="Sparkles"
                    title="Smart Suggestions"
                    subtitle="Offer a quick nudge for running logs"
                    enabled={settings.smartSuggestionsEnabled !== false}
                    onToggle={(next) => setSettings({ ...settings, smartSuggestionsEnabled: next })}
                  />
                  <ToggleRow
                    icon="Lock"
                    title="Locked-In Mode"
                    subtitle="Show a focus gate every time you open the app."
                    enabled={settings.lockedInMode}
                    onToggle={(next) => setSettings({ ...settings, lockedInMode: next })}
                  />
                  <ToggleRow
                    icon="List"
                    title="Show All Exercises"
                    subtitle="Start with the full library open"
                    enabled={settings.showAllExercises}
                    onToggle={(next) => setSettings({ ...settings, showAllExercises: next })}
                  />
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button onClick={() => setAnalyticsOpen(prev => !prev)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Analytics</div>
                  <div className="text-sm text-gray-500">Progress view</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
              </button>
              {analyticsOpen && (
                <div className="space-y-3 animate-expand">
                  <button
                    onClick={onViewAnalytics}
                    className="settings-action-button"
                  >
                    Progress view
                  </button>
                  <button
                    onClick={onViewMuscleMap}
                    className="settings-action-button"
                  >
                    Muscle map
                  </button>
                  <button
                    onClick={onViewPatterns}
                    className="settings-action-button"
                  >
                    Patterns
                  </button>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button
                onClick={() => setAdvancedOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Developer options</div>
                  <div className="text-sm text-gray-500">Advanced preview tools</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-3 animate-expand">
                  <ToggleRow
                    icon="BarChart"
                    title="Use Demo Data (30 days)"
                    subtitle="Preview analytics and patterns with seeded data"
                    enabled={settings.useDemoData}
                    onToggle={(next) => setSettings({ ...settings, useDemoData: next })}
                  />
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button
                onClick={() => setLearnOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Learn</div>
                  <div className="text-sm text-gray-500">Quick hits</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${learnOpen ? 'rotate-180' : ''}`} />
              </button>
              {learnOpen && (
                <div className="space-y-2 animate-expand">
                  {learnItems.map(item => (
                    <details key={item.title} className="border border-gray-200 rounded-xl p-3 bg-white">
                      <summary className="text-sm font-bold text-gray-900 cursor-pointer">{item.title}</summary>
                      <p className="text-sm text-gray-600 mt-2">{item.body}</p>
                    </details>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button onClick={() => setAboutOpen(prev => !prev)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">About</div>
                  <div className="text-sm text-gray-500">What this app is for</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              {aboutOpen && (
                <div className="space-y-3 animate-expand">
                  <div className="text-sm text-gray-600">A calm, no-noise workout tracker focused on simple logging and steady progress.</div>
                  <div className="text-xs text-gray-500">Version {APP_VERSION}</div>
                  <div className="grid grid-cols-1 gap-2">
                    <a href={`mailto:${FEEDBACK_EMAIL}`} target="_blank" rel="noopener noreferrer" className="w-full p-3 rounded-xl border border-gray-200 text-left font-semibold text-sm bg-white">
                      Send feedback
                    </a>
                    <a href={FOLLOW_URL} target="_blank" rel="noopener noreferrer" className="w-full p-3 rounded-xl border border-gray-200 text-left font-semibold text-sm bg-white">
                      Follow updates
                    </a>
                    <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="w-full p-3 rounded-xl border border-gray-200 text-left font-semibold text-sm bg-white">
                      Support the app
                    </a>
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <button
                onClick={() => setDataToolsOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase">Data tools</div>
                  <div className="text-sm text-gray-500">Export, import, and reset</div>
                </div>
                <Icon name="ChevronDown" className={`w-4 h-4 text-gray-400 transition-transform ${dataToolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {dataToolsOpen && (
                <div className="grid grid-cols-1 gap-2 animate-expand">
                  <button
                    onClick={onExportData}
                    className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-900 font-bold active:scale-[0.98]"
                  >
                    Export Data
                  </button>
                  <button
                    onClick={onImportData}
                    className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-900 font-bold active:scale-[0.98]"
                  >
                    Import Data
                  </button>
                  <button
                    onClick={onResetApp}
                    className="w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold active:scale-[0.98]"
                  >
                    Reset App
                  </button>
                  <button
                    onClick={onResetOnboarding}
                    className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-900 font-bold active:scale-[0.98]"
                  >
                    Reset onboarding
                  </button>
                </div>
              )}
            </Card>

          </div>
        </div>
      );
    };

    const MuscleMapScreen = ({ history, onClose }) => {
      const [rangeDays, setRangeDays] = useState(30);

      // Adjust time ranges or add muscle groups by editing these lists.
      const rangeOptions = [
        { label: '7D', days: 7 },
        { label: '30D', days: 30 },
        { label: '90D', days: 90 }
      ];

      const muscleGroups = [
        { key: 'chest', label: 'Chest', tint: 'var(--tint-chest)' },
        { key: 'back', label: 'Back', tint: 'var(--tint-back)' },
        { key: 'legs', label: 'Legs', tint: 'var(--tint-legs)' },
        { key: 'core', label: 'Core', tint: 'var(--tint-core)' },
        { key: 'arms', label: 'Arms', tint: 'var(--tint-arms)' },
        { key: 'shoulders', label: 'Shoulders', tint: 'var(--tint-shoulders)' }
      ];

      const muscleCounts = useMemo(() => buildMuscleDistribution(history, rangeDays), [history, rangeDays]);
      const totalCount = muscleGroups.reduce((sum, group) => sum + (muscleCounts[group.key] || 0), 0);
      const topGroup = muscleGroups.reduce((best, group) => {
        if (!best) return group;
        return (muscleCounts[group.key] || 0) > (muscleCounts[best.key] || 0) ? group : best;
      }, null);

      const gradient = useMemo(() => {
        if (!totalCount) return '';
        let start = 0;
        const segments = muscleGroups.reduce((acc, group) => {
          const count = muscleCounts[group.key] || 0;
          if (count <= 0) return acc;
          const degrees = (count / totalCount) * 360;
          acc.push(`${group.tint} ${start}deg ${start + degrees}deg`);
          start += degrees;
          return acc;
        }, []);
        return `conic-gradient(${segments.join(', ')})`;
      }, [muscleCounts, muscleGroups, totalCount]);

      return (
        <div className="muscle-map-screen flex flex-col h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="p-4 flex items-center gap-3">
              <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
                <Icon name="ChevronLeft" className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">Profile</div>
                <div className="text-lg font-black text-gray-900">Muscle Map</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
            <div className="muscle-map-header">
              <div className="text-xl font-black text-gray-900">Muscle Map</div>
              <div className="text-sm text-gray-500">This chart shows which muscle groups you’ve focused on over the selected time range.</div>
            </div>

            <div className="muscle-map-range-toggle">
              {rangeOptions.map(option => (
                <button
                  key={option.days}
                  onClick={() => setRangeDays(option.days)}
                  className={`muscle-map-toggle ${rangeDays === option.days ? 'active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {totalCount === 0 ? (
              <div className="muscle-map-empty">
                <div className="muscle-map-empty-title">Nothing to show yet.</div>
                <div className="muscle-map-empty-body">As you log workouts, this chart will highlight where you’ve been focusing. No streaks, no pressure.</div>
              </div>
            ) : (
              <>
                <div className="muscle-pie-wrapper">
                  <div className="muscle-pie" style={{ background: gradient }}>
                    <div className="muscle-pie-inner">
                      <div className="muscle-pie-label">
                        <div className="muscle-pie-title">{topGroup?.label || 'Focus'}</div>
                        <div className="muscle-pie-subline">Most sessions in the last {rangeDays} days</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="muscle-legend">
                  {muscleGroups.map(group => {
                    const count = muscleCounts[group.key] || 0;
                    const percent = totalCount ? Math.round((count / totalCount) * 100) : 0;
                    return (
                      <div key={group.key} className="muscle-legend-item">
                        <span className="muscle-legend-dot" style={{ background: group.tint }}></span>
                        <span className="muscle-legend-label">{group.label}</span>
                        <span className="muscle-legend-value">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      );
    };

    const PatternsScreen = ({ history, cardioHistory, onClose }) => {
      const patterns = useMemo(() => buildPatternsFromHistory(history, cardioHistory), [history, cardioHistory]);

      return (
        <div className="patterns-screen flex flex-col h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="p-4 flex items-center gap-3">
              <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
                <Icon name="ChevronLeft" className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">Profile</div>
                <div className="text-lg font-black text-gray-900">Patterns</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
            <div className="patterns-coming-soon">
              <div className="patterns-coming-title">Patterns (Coming Soon)</div>
              <div className="patterns-coming-body">
                This feature is in progress. Soon you’ll see gentle, no-guilt notes about your training style—like time-of-day tendencies and muscle-group balance.
              </div>
            </div>
            <div className="pattern-intro bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Gentle insights from your recent training.</div>
              <div className="text-xs text-gray-500">These update as you keep logging sessions.</div>
            </div>

            {patterns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-600">
                <div className="text-3xl mb-2">🌱</div>
                <div className="text-sm font-semibold text-gray-900 mb-2">No patterns yet</div>
                <div className="text-sm text-gray-500">As you log more sessions, we’ll highlight your training patterns here.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {patterns.map((pattern, idx) => (
                  <div key={`${pattern.title}-${idx}`} className="pattern-card">
                    <div className="pattern-icon">{pattern.icon || '✨'}</div>
                    <div className="flex-1">
                      <div className="pattern-title">{pattern.title}</div>
                      {pattern.subtext && <div className="pattern-subtext">{pattern.subtext}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };

// ========== CARDIO LOGGER ==========
const CardioLogger = ({ id, onClose, onUpdateSessionLogs, sessionLogs, history, settings }) => {
  const eq = EQUIPMENT_DB[id] || { name: 'Cardio', emoji: '🏃' };
  const isRunning = eq?.cardioGroup === 'running';
  const isSwimming = eq?.cardioGroup === 'swimming';
  const [entries, setEntries] = useState(sessionLogs || []);
  const [showForm, setShowForm] = useState(false);
  const [environment, setEnvironment] = useState('road');
  const [durationMin, setDurationMin] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('mi');
  const [swimMode, setSwimMode] = useState('laps');
  const [poolType, setPoolType] = useState('25yd');
  const [laps, setLaps] = useState('');
  const [stroke, setStroke] = useState('');
  const [effort, setEffort] = useState('moderate');
  const [incline, setIncline] = useState('');
  const [notes, setNotes] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const durationRef = useRef(null);

  useEffect(() => {
    setEntries(sessionLogs || []);
  }, [sessionLogs, id]);

  useEffect(() => {
    if (showForm) {
      requestAnimationFrame(() => durationRef.current?.focus());
    }
  }, [showForm, id]);

  useEffect(() => {
    if (swimMode === 'laps') {
      setDistance('');
    }
    if (swimMode === 'distance') {
      setLaps('');
    }
    if (swimMode === 'time_only') {
      setDistance('');
      setLaps('');
    }
  }, [swimMode]);

  const formatPace = (value) => {
    if (!Number.isFinite(value)) return null;
    const totalSeconds = Math.round(value * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getDistanceUnitLabel = (entry) => entry?.distanceUnit || distanceUnit || 'mi';

  const getPoolUnitLabel = (pool) => {
    if (pool === '25m' || pool === '50m') return 'm';
    return 'yd';
  };

  const getRunningEnvironmentLabel = (env) => {
    const map = {
      treadmill: 'Treadmill',
      indoor_track: 'Indoor track',
      outdoor_track: 'Outdoor track',
      road: 'Road',
      trail: 'Trail',
      other: 'Other'
    };
    return map[env] || (env ? env.replace(/_/g, ' ') : '');
  };

  const getPoolTypeLabel = (pool) => {
    const map = {
      '25yd': '25 yd',
      '25m': '25 m',
      '50m': '50 m',
      open_water: 'Open water'
    };
    return map[pool] || (pool ? pool.replace(/_/g, ' ') : '');
  };

  const poolUnitLabel = useMemo(() => getPoolUnitLabel(poolType), [poolType]);

  const poolLength = useMemo(() => {
    if (poolType === '25yd') return 25;
    if (poolType === '25m') return 25;
    if (poolType === '50m') return 50;
    return null;
  }, [poolType]);

  const buildRunningSummary = (entry) => {
    if (!entry) return null;
    const mins = Number(entry.durationMin ?? entry.minutes);
    const dist = Number(entry.distance);
    const env = entry.environment;
    const entryEffort = entry.effort;
    const parts = [];
    if (Number.isFinite(mins) && mins > 0) parts.push(`${mins} min`);
    if (Number.isFinite(dist) && dist > 0) parts.push(`${dist} ${getDistanceUnitLabel(entry)}`);
    if (env) parts.push(getRunningEnvironmentLabel(env));
    if (entryEffort) parts.push(entryEffort);
    return parts.join(' · ');
  };

  const buildSwimSummary = (entry) => {
    if (!entry) return null;
    const mins = Number(entry.durationMin ?? entry.minutes);
    const dist = Number(entry.distance);
    const pool = entry.poolType;
    const unitLabel = entry.distanceUnit || getPoolUnitLabel(pool);
    const entryStroke = entry.stroke;
    const entryEffort = entry.effort;
    const parts = [];
    if (Number.isFinite(mins) && mins > 0) parts.push(`${mins} min`);
    if (Number.isFinite(dist) && dist > 0) parts.push(`${dist} ${unitLabel}`);
    if (pool) parts.push(getPoolTypeLabel(pool));
    if (entryStroke) parts.push(entryStroke);
    if (entryEffort) parts.push(entryEffort);
    return parts.join(' · ');
  };

  const lastRunningEntry = useMemo(() => {
    if (!isRunning) return null;
    const sessions = Array.isArray(history) ? history : [];
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      const entriesList = sessions[i]?.entries || [];
      for (let j = entriesList.length - 1; j >= 0; j -= 1) {
        const entry = entriesList[j];
        if (entry?.kind === 'cardio') return entry;
      }
    }
    return null;
  }, [history, isRunning]);

  const lastSwimEntry = useMemo(() => {
    if (!isSwimming) return null;
    const sessions = Array.isArray(history) ? history : [];
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      const entriesList = sessions[i]?.entries || [];
      for (let j = entriesList.length - 1; j >= 0; j -= 1) {
        const entry = entriesList[j];
        if (entry?.kind === 'cardio') return entry;
      }
    }
    return null;
  }, [history, isSwimming]);

  const lastRunningSummary = isRunning ? buildRunningSummary(lastRunningEntry) : null;
  const lastSwimSummary = isSwimming ? buildSwimSummary(lastSwimEntry) : null;

  const smartSuggestionsEnabled = settings?.smartSuggestionsEnabled !== false;
  const lastRunningDuration = Number(lastRunningEntry?.durationMin ?? lastRunningEntry?.minutes);
  const lastRunningDistance = Number(lastRunningEntry?.distance);
  const lastRunningUnit = getDistanceUnitLabel(lastRunningEntry);
  const canSuggestRunning = smartSuggestionsEnabled
    && isRunning
    && Number.isFinite(lastRunningDuration)
    && lastRunningDuration > 0
    && Number.isFinite(lastRunningDistance)
    && lastRunningDistance > 0;
  const suggestedDuration = canSuggestRunning ? Math.round(lastRunningDuration + 2) : null;
  const suggestedDistance = canSuggestRunning ? Number((lastRunningDistance * 1.05).toFixed(2)) : null;

  const removeEntry = (entryId) => {
    const nextEntries = entries.filter(entry => entry.id !== entryId);
    setEntries(nextEntries);
    onUpdateSessionLogs?.(id, nextEntries);
  };

  const durationValue = Number(durationMin);
  const distanceValue = Number(distance);
  const hasDuration = Number.isFinite(durationValue) && durationValue > 0;
  const hasRunningDistance = Number.isFinite(distanceValue) && distanceValue > 0;
  const canSaveRunning = hasDuration && hasRunningDistance;

  const lapsValue = Number(laps);
  const hasLaps = Number.isFinite(lapsValue) && lapsValue > 0;
  const swimDistanceValue = (() => {
    if (swimMode === 'laps' && hasLaps && poolLength) return lapsValue * poolLength;
    if (swimMode === 'distance' && Number.isFinite(distanceValue) && distanceValue > 0) return distanceValue;
    return null;
  })();
  const swimDistanceRequired = swimMode === 'laps' || swimMode === 'distance';
  const hasSwimDistance = !swimDistanceRequired || (Number.isFinite(swimDistanceValue) && swimDistanceValue > 0);
  const canSaveSwim = hasDuration && hasSwimDistance;

  const runningPace = canSaveRunning ? formatPace(durationValue / distanceValue) : null;
  const runningSpeed = canSaveRunning ? (distanceValue / (durationValue / 60)) : null;
  const swimPace = hasDuration && Number.isFinite(swimDistanceValue) && swimDistanceValue > 0
    ? formatPace((durationValue * 100) / swimDistanceValue)
    : null;

  const resetForm = () => {
    setDurationMin('');
    setDistance('');
    setDistanceUnit('mi');
    setEnvironment('road');
    setIncline('');
    setEffort('moderate');
    setSwimMode('laps');
    setPoolType('25yd');
    setLaps('');
    setStroke('');
    setNotes('');
    setShowMoreDetails(false);
  };

  const handleAddRunningEntry = () => {
    if (!canSaveRunning) return;
    const mins = Number(durationMin);
    const dist = Number(distance);
    const pacePerUnit = mins / dist;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dateISO: toDayKey(new Date()),
      ts: Date.now(),
      kind: 'cardio',
      mode: 'running',
      durationMin: mins,
      distance: dist,
      distanceUnit,
      environment,
      incline: environment === 'treadmill' && incline ? Number(incline) : null,
      swimMode: null,
      poolType: null,
      laps: null,
      stroke: null,
      effort: effort || null,
      pacePerUnit: Number.isFinite(pacePerUnit) ? pacePerUnit : null,
      pacePer100: null,
      notes: notes ? notes.trim() : null
    };
    const nextEntries = [...entries, entry];
    setEntries(nextEntries);
    onUpdateSessionLogs?.(id, nextEntries);
    setShowForm(false);
    resetForm();
  };

  const handleAddSwimEntry = () => {
    if (!canSaveSwim) return;
    const mins = Number(durationMin);
    const computedDistance = Number.isFinite(swimDistanceValue) ? swimDistanceValue : null;
    const pacePer100 = computedDistance ? (mins * 100) / computedDistance : null;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dateISO: toDayKey(new Date()),
      ts: Date.now(),
      kind: 'cardio',
      mode: 'swim',
      durationMin: mins,
      distance: computedDistance,
      distanceUnit: computedDistance ? poolUnitLabel : null,
      environment: null,
      incline: null,
      swimMode,
      poolType: poolType || null,
      laps: swimMode === 'laps' && hasLaps ? lapsValue : null,
      stroke: stroke || null,
      effort: effort || null,
      pacePerUnit: null,
      pacePer100: Number.isFinite(pacePer100) ? pacePer100 : null,
      notes: notes ? notes.trim() : null
    };
    const nextEntries = [...entries, entry];
    setEntries(nextEntries);
    onUpdateSessionLogs?.(id, nextEntries);
    setShowForm(false);
    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-50 text-gray-500">
            <Icon name="ChevronLeft" className="w-5 h-5"/>
          </button>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cardio</div>
            <div className="text-lg font-black text-gray-900">{eq.name}</div>
            {isRunning && lastRunningSummary && (
              <div className="text-[11px] text-gray-500">Last: {lastRunningSummary}</div>
            )}
            {isSwimming && lastSwimSummary && (
              <div className="text-[11px] text-gray-500">Last: {lastSwimSummary}</div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-gray-50 text-gray-500">
          <Icon name="X" className="w-5 h-5"/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase">{isRunning ? 'Running / Walking' : 'Swimming'}</div>
              <div className="text-sm text-gray-500">Log today’s entry</div>
            </div>
            <button
              onClick={() => setShowForm(prev => !prev)}
              className="px-4 py-2 rounded-xl font-bold workout-accent-solid shadow-sm active:scale-[0.98]"
            >
              + Entry
            </button>
          </div>
          {showForm && (
            <div className="space-y-3 pt-2">
              {canSuggestRunning && (
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 space-y-2">
                  <div className="text-xs font-bold text-purple-700 uppercase">Smart suggestion</div>
                  <div className="text-xs text-purple-700">Last time: {lastRunningSummary}</div>
                  <div className="text-xs text-purple-700">
                    Suggested: {suggestedDuration} min · {suggestedDistance} {lastRunningUnit}
                  </div>
                  <button
                    onClick={() => {
                      setDurationMin(String(suggestedDuration));
                      setDistance(String(suggestedDistance));
                      setDistanceUnit(lastRunningEntry?.distanceUnit || distanceUnit);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold workout-accent-solid shadow-sm active:scale-[0.98]"
                  >
                    Use suggestion
                  </button>
                </div>
              )}
              {isRunning && (
                <>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Environment</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['treadmill', 'indoor_track', 'outdoor_track', 'road', 'trail', 'other'].map(option => (
                        <button
                          key={option}
                          onClick={() => setEnvironment(option)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border ${environment === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                        >
                          {option.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Duration (min)</div>
                    <input
                      ref={durationRef}
                      type="number"
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      placeholder="e.g. 30"
                      className="w-full text-lg font-bold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Distance</div>
                      <input
                        type="number"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="e.g. 1.50"
                        className="w-full text-base font-semibold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Unit</div>
                      <select
                        value={distanceUnit}
                        onChange={(e) => setDistanceUnit(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-semibold"
                      >
                        <option value="mi">mi</option>
                        <option value="km">km</option>
                      </select>
                    </div>
                  </div>
                  {(runningPace || runningSpeed) && (
                    <div className="text-xs text-gray-500">
                      {runningPace && runningSpeed && `Pace: ${runningPace} / ${distanceUnit} · Avg speed: ${runningSpeed.toFixed(1)} ${distanceUnit}/h`}
                      {runningPace && !runningSpeed && `Pace: ${runningPace} / ${distanceUnit}`}
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => setShowMoreDetails(prev => !prev)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                    >
                      <span>More details</span>
                      <Icon name="ChevronDown" className={`w-4 h-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {showMoreDetails && (
                    <div className="space-y-3 animate-expand">
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Effort</div>
                        <div className="flex gap-2">
                          {['easy', 'moderate', 'hard'].map(option => (
                            <button
                              key={option}
                              onClick={() => setEffort(option)}
                              className={`px-3 py-2 rounded-full text-xs font-bold border ${effort === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                            >
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {environment === 'treadmill' && (
                        <div>
                          <div className="text-xs font-bold text-gray-500 uppercase mb-2">Incline (%)</div>
                          <input
                            type="number"
                            value={incline}
                            onChange={(e) => setIncline(e.target.value)}
                            placeholder="e.g. 2.0"
                            className="w-full text-base font-semibold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Notes</div>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="How did it feel?"
                          className="w-full p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900 min-h-[80px]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddRunningEntry}
                      disabled={!canSaveRunning}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                        canSaveRunning ? 'workout-accent-solid shadow-lg' : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      Save Entry
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-3 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {isSwimming && (
                <>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Swim mode</div>
                    <div className="flex gap-2">
                      {['laps', 'distance', 'time_only'].map(option => (
                        <button
                          key={option}
                          onClick={() => setSwimMode(option)}
                          className={`px-3 py-2 rounded-full text-xs font-bold border ${swimMode === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                        >
                          {option.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Pool type</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['25yd', '25m', '50m', 'open_water'].map(option => (
                        <button
                          key={option}
                          onClick={() => setPoolType(option)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border ${poolType === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                        >
                          {option.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Duration (min)</div>
                    <input
                      ref={durationRef}
                      type="number"
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      placeholder="e.g. 30"
                      className="w-full text-lg font-bold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                    />
                  </div>
                  {swimMode === 'laps' && (
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Laps</div>
                      <input
                        type="number"
                        value={laps}
                        onChange={(e) => setLaps(e.target.value)}
                        placeholder="e.g. 20"
                        className="w-full text-base font-semibold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                      />
                    </div>
                  )}
                  {swimMode === 'distance' && (
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Distance ({poolUnitLabel})</div>
                      <input
                        type="number"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="e.g. 800"
                        className="w-full text-base font-semibold text-center p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900"
                      />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">Stroke</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['freestyle', 'breaststroke', 'backstroke', 'mixed'].map(option => (
                        <button
                          key={option}
                          onClick={() => setStroke(option)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border ${stroke === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  {swimPace && (
                    <div className="text-xs text-gray-500">Pace: {swimPace} per 100 {poolUnitLabel}</div>
                  )}
                  <div>
                    <button
                      onClick={() => setShowMoreDetails(prev => !prev)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                    >
                      <span>More details</span>
                      <Icon name="ChevronDown" className={`w-4 h-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {showMoreDetails && (
                    <div className="space-y-3 animate-expand">
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Effort</div>
                        <div className="flex gap-2">
                          {['easy', 'moderate', 'hard'].map(option => (
                            <button
                              key={option}
                              onClick={() => setEffort(option)}
                              className={`px-3 py-2 rounded-full text-xs font-bold border ${effort === option ? 'workout-accent-solid border-transparent' : 'border-gray-200 text-gray-600'}`}
                            >
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Notes</div>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="How did it feel?"
                          className="w-full p-3 border-2 border-gray-200 rounded-xl workout-accent-focus outline-none bg-white text-gray-900 min-h-[80px]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddSwimEntry}
                      disabled={!canSaveSwim}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                        canSaveSwim ? 'workout-accent-solid shadow-lg' : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      Save Entry
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-3 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase text-gray-500">Today’s entries</div>
            <div className="text-[11px] workout-accent-text font-semibold">{entries.length} entries</div>
          </div>
          {entries.length === 0 ? (
            <div className="text-sm text-gray-500">No cardio entries yet.</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-gray-900">Entry {idx + 1}</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {isRunning ? buildRunningSummary(entry) : buildSwimSummary(entry)}
                    </div>
                    {entry.notes && <div className="text-[11px] text-gray-500">{entry.notes}</div>}
                  </div>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-600 active:scale-95"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// ========== MAIN APP ==========
    const App = () => {
      const [loaded, setLoaded] = useState(false);

      const [profile, setProfile] = useState({
        username: '',
        avatar: '💪',
        workoutLocation: 'gym',
        gymType: 'commercial',
        barWeight: 45,
        onboarded: false
      });

      const [settings, setSettings] = useState({ ...SETTINGS_DEFAULTS });
      const [themeMode, setThemeModeState] = useState('light');
      const [darkVariant, setDarkVariantState] = useState('blue');
      const [colorfulExerciseCards, setColorfulExerciseCards] = useState(() => {
        try {
          const raw = localStorage.getItem('ps_colorfulExerciseCards');
          return raw === null ? true : Boolean(JSON.parse(raw));
        } catch {
          return true;
        }
      });
      const [history, setHistory] = useState({});
      const [cardioHistory, setCardioHistory] = useState({});
      const [tab, setTab] = useState('home');
      const [activeEquipment, setActiveEquipment] = useState(null);
      const [activeCardio, setActiveCardio] = useState(null);
      const [pendingAutoFocusExercise, setPendingAutoFocusExercise] = useState(null);
      const [view, setView] = useState('onboarding');
      const [showAnalytics, setShowAnalytics] = useState(false);
      const [showPatterns, setShowPatterns] = useState(false);
      const [showMuscleMap, setShowMuscleMap] = useState(false);
      const [openTemplatesFromHome, setOpenTemplatesFromHome] = useState(false);
      const [homeRequestedAnalyticsTab, setHomeRequestedAnalyticsTab] = useState(null);
      const [showMatrix, setShowMatrix] = useState(false);
      const [showPowerUp, setShowPowerUp] = useState(false);
      const [showGlory, setShowGlory] = useState(false);
      const [showSpartan, setShowSpartan] = useState(false);
      const [showButDidYouDie, setShowButDidYouDie] = useState(false);
      const [showNice, setShowNice] = useState(false);
      const [showPerfectWeek, setShowPerfectWeek] = useState(false);
      const [activeSession, setActiveSession] = useState(null);
      const [inlineMessage, setInlineMessage] = useState(null);
      const messageTimerRef = useRef(null);
      const [toasts, setToasts] = useState([]);
      const [undoToast, setUndoToast] = useState(null);
      const undoTimerRef = useRef(null);
      const undoActionRef = useRef(null);
      const [sessionStartNotice, setSessionStartNotice] = useState(null);
      const sessionStartTimerRef = useRef(null);
      const [showPostWorkout, setShowPostWorkout] = useState(false);
      const [showPostWorkoutCelebration, setShowPostWorkoutCelebration] = useState(false);
      const [postWorkoutQuote, setPostWorkoutQuote] = useState(null);
      const postWorkoutTimerRef = useRef(null);
      const postWorkoutCelebrationRef = useRef(null);
      const rageTapRef = useRef(new Map());

      const [appState, setAppState] = useState({
        lastWorkoutType: null,
        lastWorkoutDayKey: null,
        restDays: []
      });

      const [pinnedExercises, setPinnedExercises] = useState([]);
      const [starredExercises, setStarredExercises] = useState([]);
      const [recentExercises, setRecentExercises] = useState([]);
      const [exerciseUsageCounts, setExerciseUsageCounts] = useState({});
      const [dayEntries, setDayEntries] = useState({});
      const [lastExerciseStats, setLastExerciseStats] = useState({});
      const [draftPlan, setDraftPlan] = useState(null);
      const [dismissedDraftDate, setDismissedDraftDate] = useState(null);
      const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * motivationalQuotes.length));
      const [generatorOptions, setGeneratorOptions] = useState({ goal: '', duration: 45, equipment: '' });
      const [lockedInDismissed, setLockedInDismissed] = useState(false);

      useEffect(() => {
        if (!DEBUG_LOG) return;
        const rageTapWindow = 2000;
        const rageTapThreshold = 5;
        const handleRageTap = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          const button = target.closest('button, [role="button"], a');
          if (!button) return;
          const identifier = button.getAttribute('aria-label')
            || button.getAttribute('data-debug-id')
            || button.id
            || button.textContent?.trim().slice(0, 80)
            || button.className
            || 'unknown';
          const now = Date.now();
          const record = rageTapRef.current.get(identifier) || { count: 0, start: now };
          if (now - record.start > rageTapWindow) {
            record.count = 0;
            record.start = now;
          }
          record.count += 1;
          rageTapRef.current.set(identifier, record);
          if (record.count >= rageTapThreshold) {
            debugLog('rage_tap', { target: identifier });
            rageTapRef.current.delete(identifier);
          }
        };
        document.addEventListener('click', handleRageTap, true);
        return () => document.removeEventListener('click', handleRageTap, true);
      }, []);

      const normalizeActiveSession = (session) => {
        if (!session) return null;
        const date = session.dateKey || session.date || toDayKey(new Date());
        const logsByExercise = session.logsByExercise || session.setsByExercise || {};
        const rawItems = session.items || Object.values(session.exercises || {}).map(entry => ({
          exerciseId: entry.id,
          name: entry.label,
          sets: entry.sets || 0,
          kind: entry.kind || 'strength'
        }));
        const items = rawItems.map(item => {
          const exerciseId = item.exerciseId || item.id;
          const name = item.name || item.label || EQUIPMENT_DB[exerciseId]?.name || 'Exercise';
          const muscleGroup = item.muscleGroup || EQUIPMENT_DB[exerciseId]?.target || '';
          const derivedKind = EQUIPMENT_DB[exerciseId]?.type === 'cardio' ? 'cardio' : (item.kind || 'strength');
          const fallbackSets = item.sets || 0;
          if (!logsByExercise[exerciseId]) {
            logsByExercise[exerciseId] = derivedKind === 'cardio'
              ? []
              : Array.from({ length: fallbackSets }, () => ({ reps: null, weight: null }));
          }
          const resolvedSets = logsByExercise[exerciseId] || [];
          return {
            exerciseId,
            name,
            muscleGroup,
            kind: derivedKind,
            sets: resolvedSets.length,
            id: exerciseId,
            label: name
          };
        });
        const normalizedStatus = session.status === 'in_progress' ? 'active' : session.status;
        return {
          date,
          status: normalizedStatus || 'draft',
          items,
          logsByExercise,
          createdFrom: session.createdFrom || 'manual'
        };
      };

      const normalizeDraftPlan = (draft) => {
        if (!draft) return null;
        if (draft.exercises) {
          return {
            date: draft.date || toDayKey(new Date()),
            label: draft.label || 'Workout Draft',
            exercises: draft.exercises || [],
            options: draft.options || {},
            status: 'draft',
            createdFrom: draft.createdFrom || 'generated'
          };
        }
        if (draft.items) {
          return {
            date: draft.date || toDayKey(new Date()),
            label: draft.label || 'Workout Draft',
            exercises: (draft.items || []).map(item => item.id),
            options: draft.options || {},
            status: 'draft',
            createdFrom: draft.createdFrom || 'generated'
          };
        }
        return null;
      };

      useEffect(() => {
        const savedOnboarding = storage.get(ONBOARDING_KEY, false);
        const savedProfileRaw = storage.get('ps_v2_profile', null);
        const settingsDefaults = { ...SETTINGS_DEFAULTS };
        const savedSettingsRaw = storage.get('ps_v2_settings', settingsDefaults);
        const savedSettings = { ...settingsDefaults, ...savedSettingsRaw };
        const savedHistory = storage.get('ps_v2_history', {});
        const savedCardio = storage.get('ps_v2_cardio', {});
        const savedState = storage.get('ps_v2_state', { lastWorkoutType: null, lastWorkoutDayKey: null, restDays: [] });
        const savedRestDays = storage.get(REST_DAY_KEY, []);
        const savedDismiss = storage.get('ps_dismissed_draft_date', null);
        const savedTodaySession = storage.get(TODAY_SESSION_KEY, null);
        const savedTodayWorkout = storage.get(TODAY_WORKOUT_KEY, null);
        const savedActiveSession = storage.get(ACTIVE_SESSION_KEY, null);
        const savedDraftSession = storage.get(DRAFT_SESSION_KEY, null);
        let savedStarred = [];
        try {
          const raw = localStorage.getItem('ps_starredExercises');
          savedStarred = raw ? JSON.parse(raw) : [];
        } catch {
          savedStarred = [];
        }
        const normalizedActiveSession = normalizeActiveSession(
          savedTodaySession || savedTodayWorkout || savedActiveSession || savedDraftSession
        );
        const currentDayKey = toDayKey(new Date());
        const mergedRestDays = Array.from(new Set([...(savedState?.restDays || []), ...(savedRestDays || [])]));
        
        const migratedProfile = {
          username: '',
          avatar: '💪',
          workoutLocation: 'gym',
          gymType: 'commercial',
          barWeight: 45,
          onboarded: false,
          ...(savedProfileRaw || {}),
        };
        migratedProfile.workoutLocation = migratedProfile.workoutLocation || (migratedProfile.gymType === 'home' ? 'home' : 'gym');
        migratedProfile.gymType = migratedProfile.gymType || (migratedProfile.workoutLocation === 'home' ? 'home' : 'commercial');
        migratedProfile.onboarded = migratedProfile.onboarded || !!savedOnboarding;

        if (savedProfileRaw) setProfile(migratedProfile);
        if (migratedProfile.onboarded) setView('app');

        setSettings(savedSettings);
        setHistory(savedHistory);
        setCardioHistory(savedCardio);
        setAppState({ ...savedState, restDays: mergedRestDays });
        storage.set(REST_DAY_KEY, mergedRestDays);
        setDismissedDraftDate(savedDismiss);
        const resolvedTodaySession = normalizedActiveSession?.date === currentDayKey ? normalizedActiveSession : null;
        setActiveSession(resolvedTodaySession);
        setDraftPlan(null);
        if (resolvedTodaySession) {
          storage.set(TODAY_SESSION_KEY, resolvedTodaySession);
        }

        const savedMeta = storage.get(STORAGE_KEY, null);
        const baseMeta = {
          version: STORAGE_VERSION,
          pinnedExercises: savedSettings?.pinnedExercises || [],
          recentExercises: [],
          exerciseUsageCounts: {},
          dayEntries: {},
          lastExerciseStats: {}
        };

        let metaToUse = baseMeta;
        if (savedMeta?.version === STORAGE_VERSION) {
          metaToUse = { ...baseMeta, ...savedMeta };
        } else {
          metaToUse = {
            ...baseMeta,
            recentExercises: deriveRecentExercises(savedHistory, 12),
            exerciseUsageCounts: deriveUsageCountsFromHistory(savedHistory),
            dayEntries: buildDayEntriesFromHistory(savedHistory, savedCardio, savedState?.restDays || [])
          };
          storage.set(STORAGE_KEY, metaToUse);
        }

        setPinnedExercises(metaToUse.pinnedExercises || []);
        setStarredExercises(Array.isArray(savedStarred) ? savedStarred : []);
        setRecentExercises(metaToUse.recentExercises || []);
        setExerciseUsageCounts(metaToUse.exerciseUsageCounts || {});
        setDayEntries(metaToUse.dayEntries || {});
        setLastExerciseStats(metaToUse.lastExerciseStats || {});
        setLoaded(true);
      }, []);

      useEffect(() => { 
        if(loaded) {
          storage.set('ps_v2_profile', profile); 
          storage.set(ONBOARDING_KEY, !!profile.onboarded);
        }
      }, [profile, loaded]);
      useEffect(() => { if(loaded) storage.set('ps_v2_settings', settings); }, [settings, loaded]);
      useEffect(() => {
        if (!loaded) return;
        try {
          localStorage.setItem('ps_starredExercises', JSON.stringify(starredExercises));
        } catch {
          return;
        }
      }, [starredExercises, loaded]);
      useEffect(() => {
        if (!loaded) return;
        try {
          localStorage.setItem('ps_colorfulExerciseCards', JSON.stringify(!!colorfulExerciseCards));
        } catch {
          return;
        }
      }, [colorfulExerciseCards, loaded]);
      useEffect(() => {
        document.body.classList.toggle('exercise-colors-off', !colorfulExerciseCards);
      }, [colorfulExerciseCards]);
      useEffect(() => {
        if (!loaded) return;
        const persist = () => storage.set('ps_v2_history', history);
        if (typeof requestIdleCallback === 'function') {
          const idleId = requestIdleCallback(persist);
          return () => cancelIdleCallback(idleId);
        }
        const timeoutId = setTimeout(persist, 0);
        return () => clearTimeout(timeoutId);
      }, [history, loaded]);
      useEffect(() => {
        if (!loaded) return;
        const persist = () => storage.set('ps_v2_cardio', cardioHistory);
        if (typeof requestIdleCallback === 'function') {
          const idleId = requestIdleCallback(persist);
          return () => cancelIdleCallback(idleId);
        }
        const timeoutId = setTimeout(persist, 0);
        return () => clearTimeout(timeoutId);
      }, [cardioHistory, loaded]);
      useEffect(() => {
        if (!loaded) return;
        storage.set('ps_v2_state', appState);
        storage.set(REST_DAY_KEY, appState?.restDays || []);
      }, [appState, loaded]);
      useEffect(() => { if(loaded) storage.set('ps_dismissed_draft_date', dismissedDraftDate); }, [dismissedDraftDate, loaded]);
      useEffect(() => {
        if (!loaded) return;
        const persist = () => storage.set(TODAY_SESSION_KEY, activeSession);
        if (typeof requestIdleCallback === 'function') {
          const idleId = requestIdleCallback(persist);
          return () => cancelIdleCallback(idleId);
        }
        const timeoutId = setTimeout(persist, 0);
        return () => clearTimeout(timeoutId);
      }, [activeSession, loaded]);
      useEffect(() => {
        if (!loaded) return;
        storage.set(STORAGE_KEY, {
          version: STORAGE_VERSION,
          pinnedExercises,
          recentExercises,
          exerciseUsageCounts,
          dayEntries,
          lastExerciseStats
        });
      }, [loaded, pinnedExercises, recentExercises, exerciseUsageCounts, dayEntries, lastExerciseStats]);

      useEffect(() => {
        return () => {
          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
        };
      }, []);

      useEffect(() => {
        return () => {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        };
      }, []);

      useEffect(() => {
        if (!sessionStartNotice) return;
        if (sessionStartTimerRef.current) clearTimeout(sessionStartTimerRef.current);
        sessionStartTimerRef.current = setTimeout(() => setSessionStartNotice(null), 4000);
        return () => {
          if (sessionStartTimerRef.current) clearTimeout(sessionStartTimerRef.current);
        };
      }, [sessionStartNotice]);

      useEffect(() => {
        if (!settings.lockedInMode) {
          setLockedInDismissed(false);
        }
      }, [settings.lockedInMode]);

      const pushMessage = (text) => {
        if (!text || text === 'Workout saved.') return;
        setInlineMessage(text);
        if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
        messageTimerRef.current = setTimeout(() => setInlineMessage(null), 3200);
      };

      const showToast = useCallback((message) => {
        if (!message) return;
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message }]);
        setTimeout(() => {
          setToasts(prev => prev.filter((toast) => toast.id !== id));
        }, 2600);
      }, []);

      const showUndoToast = ({ message, onUndo, onCommit }) => {
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
          if (undoActionRef.current?.onCommit) {
            undoActionRef.current.onCommit();
          }
        }
        undoActionRef.current = { onUndo, onCommit };
        setUndoToast({ message });
        undoTimerRef.current = setTimeout(() => {
          const commit = undoActionRef.current?.onCommit;
          undoActionRef.current = null;
          setUndoToast(null);
          if (commit) commit();
        }, 3000);
      };

      const handleUndoAction = () => {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        const undo = undoActionRef.current?.onUndo;
        undoActionRef.current = null;
        setUndoToast(null);
        if (undo) undo();
      };

      useEffect(() => {
        if (!loaded) return;
        const lastOpen = storage.get(LAST_OPEN_KEY, null);
        const now = new Date();
        if (lastOpen) {
          const diffDays = Math.floor((now - new Date(lastOpen)) / (1000 * 60 * 60 * 24));
          if (diffDays >= 4) {
            pushMessage(COPY_PUSH.welcomeBackLong);
          } else if (diffDays >= 1 && Math.random() < 0.35) {
            const options = COPY_PUSH.welcomeBack;
            pushMessage(options[Math.floor(Math.random() * options.length)]);
          }
        } else if (Math.random() < 0.25) {
          pushMessage(COPY_PUSH.readyDefault);
        }
        storage.set(LAST_OPEN_KEY, now.toISOString());
      }, [loaded]);

      const applyTheme = () => {
        const savedMode = storage.get(THEME_MODE_KEY, 'light');
        const storedVariant = storage.get(DARK_VARIANT_KEY, 'blue');
        const nextVariant = storedVariant || 'blue';
        const themeClasses = ['theme-red', 'theme-yellow', 'theme-blue'];
        document.body.classList.remove(...themeClasses);
        if (savedMode === 'dark') {
          document.body.classList.add('dark-mode');
          document.body.classList.add(`theme-${nextVariant}`);
        } else {
          document.body.classList.remove('dark-mode');
        }
        setThemeModeState(savedMode);
        setDarkVariantState(nextVariant);
      };

      const setThemeMode = (mode) => {
        storage.set(THEME_MODE_KEY, mode);
        if (!storage.get(DARK_VARIANT_KEY, null)) {
          storage.set(DARK_VARIANT_KEY, 'blue');
        }
        applyTheme();
      };

      const setDarkVariant = (variant) => {
        storage.set(DARK_VARIANT_KEY, variant);
        applyTheme();
      };

      useEffect(() => {
        applyTheme();
      }, []);

      const effectiveData = useMemo(() => getEffectiveData({
        history,
        cardioHistory,
        restDays: appState?.restDays || [],
        dayEntries
      }, settings.useDemoData), [history, cardioHistory, appState?.restDays, dayEntries, settings.useDemoData]);
      const effectiveHistory = effectiveData.history;
      const effectiveCardioHistory = effectiveData.cardioHistory;
      const effectiveRestDays = effectiveData.restDays;
      const effectiveDayEntries = effectiveData.dayEntries;

      const todayWorkoutType = useMemo(() => getTodaysWorkoutType(effectiveHistory, appState), [effectiveHistory, appState]);

      const strengthScoreObj = useMemo(() => {
        if (!showAnalytics) {
          return { score: 0, avgPct: 0, coveragePct: 0, loggedCount: 0, total: Object.keys(EQUIPMENT_DB).length };
        }
        if (!profile?.onboarded) return { score: 0, avgPct: 0, coveragePct: 0, loggedCount: 0, total: Object.keys(EQUIPMENT_DB).length };
        return computeStrengthScore(profile, effectiveHistory);
      }, [profile, effectiveHistory, showAnalytics]);

      const streakObj = useMemo(() => computeStreak(effectiveHistory, effectiveCardioHistory, effectiveRestDays, effectiveDayEntries), [effectiveHistory, effectiveCardioHistory, effectiveRestDays, effectiveDayEntries]);

      const achievements = useMemo(() => {
        if (!showAnalytics) return [];
        return computeAchievements({ history: effectiveHistory, cardioHistory: effectiveCardioHistory, strengthScoreObj, streakObj });
      }, [effectiveHistory, effectiveCardioHistory, strengthScoreObj, streakObj, showAnalytics]);

      const lastWorkoutDate = useMemo(() => getLastWorkoutDate(effectiveHistory, effectiveCardioHistory), [effectiveHistory, effectiveCardioHistory]);

      const lastWorkoutLabel = useMemo(() => {
        if (!lastWorkoutDate) return null;
        const today = new Date();
        const diffDays = Math.floor((today - lastWorkoutDate) / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return lastWorkoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }, [lastWorkoutDate]);

      const sessionSummary = useMemo(
        () => buildLastSessionSummary(effectiveHistory, lastWorkoutLabel),
        [effectiveHistory, lastWorkoutLabel]
      );
      const lastSessionSummary = sessionSummary?.full;
      const lastSessionShortLabel = sessionSummary?.short;
      const lastSessionDetail = sessionSummary?.detail;

      const weekWorkoutCount = useMemo(() => {
        const today = new Date();
        let count = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(today);
          day.setDate(today.getDate() - i);
          const key = toDayKey(day);
          if (effectiveDayEntries?.[key]?.type === 'workout') count += 1;
        }
        return count;
      }, [effectiveDayEntries]);

      const streak = streakObj?.current || 0;
      const sessionsThisWeek = weekWorkoutCount || 0;

      const coachMessage = useMemo(
        () => getCoachMessage({ streak, sessionsThisWeek }),
        [streak, sessionsThisWeek]
      );
      const shouldShowLockedInGate = settings.lockedInMode && !lockedInDismissed;

      const recordDayEntry = (dayKey, type = 'workout', extras = {}) => {
        setDayEntries(prev => {
          const existing = prev[dayKey];
          const resolvedType = existing?.type === 'workout' ? 'workout' : type;
          return { ...prev, [dayKey]: { ...(existing || {}), ...extras, type: resolvedType, date: dayKey } };
        });
      };

      const recordExerciseUse = (exerciseId, sets = []) => {
        if (!exerciseId) return;
        setRecentExercises(prev => {
          const filtered = prev.filter(id => id !== exerciseId);
          return [exerciseId, ...filtered].slice(0, 12);
        });
        setExerciseUsageCounts(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] || 0) + Math.max(1, sets.length || 1) }));
        if (sets && sets.length > 0) {
          const lastSet = sets[sets.length - 1];
          setLastExerciseStats(prev => ({ ...prev, [exerciseId]: { weight: lastSet.weight, reps: lastSet.reps } }));
        }
      };

      const toggleStarredExercise = (exerciseId) => {
        if (!exerciseId) return;
        setStarredExercises(prev => prev.includes(exerciseId)
          ? prev.filter(id => id !== exerciseId)
          : [...prev, exerciseId]
        );
      };

      const todayKey = toDayKey(new Date());
      const activeSessionToday = activeSession?.date === todayKey ? activeSession : null;
      const draftPlanToday = draftPlan?.date === todayKey ? draftPlan : null;
      const restDayDates = Array.isArray(effectiveRestDays) ? effectiveRestDays : [];
      const isRestDay = restDayDates.includes(todayKey);
      const sessionIntent = useMemo(() => {
        if (isRestDay) return 'recovery';
        if (lastWorkoutLabel === 'Today') return 'calm';
        return 'standard';
      }, [isRestDay, lastWorkoutLabel]);
      const homeQuote = useMemo(() => getDailyQuote(homeQuotes, 'home'), [todayKey]);
      const suggestedFocus = useMemo(() => {
        const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
        const workoutDays = Object.entries(effectiveDayEntries || {})
          .filter(([, entry]) => entry?.type === 'workout')
          .sort((a, b) => new Date(b[0]) - new Date(a[0]))
          .slice(0, 2);
        if (workoutDays.length === 0) return 'Full Body';
        const used = new Set();
        workoutDays.forEach(([, entry]) => {
          (Array.isArray(entry.exercises) ? entry.exercises : []).forEach(id => {
            const group = resolveMuscleGroup(EQUIPMENT_DB[id]);
            if (group) used.add(group);
          });
        });
        const remaining = muscleGroups.filter(group => !used.has(group));
        return remaining[0] || 'Full Body';
      }, [effectiveDayEntries]);

      useEffect(() => {
        if (!isRestDay) return;
        setActiveEquipment(null);
        setActiveCardio(null);
        setActiveSession(null);
        setDraftPlan(null);
        setDismissedDraftDate(null);
      }, [isRestDay]);

      // Easter egg: Perfect Week detection (7 consecutive days)
      useEffect(() => {
        const checkPerfectWeek = () => {
          const today = new Date();
          const last7Days = [];
          for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            last7Days.push(toDayKey(date));
          }
          
          const hasAllWorkouts = last7Days.every(dayKey => {
            const entry = effectiveDayEntries[dayKey];
            return entry && entry.type === 'workout';
          });
          
          if (hasAllWorkouts) {
            const lastShown = localStorage.getItem('lastPerfectWeekShown');
            if (lastShown !== todayKey) {
              setShowPerfectWeek(true);
              localStorage.setItem('lastPerfectWeekShown', todayKey);
            }
          }
        };
        
        checkPerfectWeek();
      }, [effectiveDayEntries, todayKey]);

      const createEmptySession = (overrides = {}) => ({
        date: todayKey,
        status: 'draft',
        items: [],
        logsByExercise: {},
        createdFrom: overrides.createdFrom || 'manual',
        ...overrides
      });

      const updateSessionItemsByIds = (ids = [], options = {}) => {
        const uniqueIds = Array.from(new Set(ids));
        setActiveSession(prev => {
          const base = (!prev || prev.date !== todayKey) ? createEmptySession({ createdFrom: options.createdFrom || 'manual' }) : prev;
          const items = buildSessionItemsFromIds(uniqueIds, base.items || []);
          const logsByExercise = { ...(base.logsByExercise || {}) };
          uniqueIds.forEach(id => {
            if (!logsByExercise[id]) logsByExercise[id] = [];
          });
          Object.keys(logsByExercise).forEach(key => {
            if (!uniqueIds.includes(key)) delete logsByExercise[key];
          });
          return {
            ...base,
            status: options.status || base.status,
            createdFrom: options.createdFrom || base.createdFrom || 'manual',
            items,
            logsByExercise
          };
        });
      };

      const buildSessionItem = (exerciseId, kind = 'strength') => {
        const equipment = EQUIPMENT_DB[exerciseId];
        const derivedKind = equipment?.type === 'cardio' ? 'cardio' : kind;
        const name = equipment?.name || 'Exercise';
        const muscleGroup = equipment?.target || '';
        return {
          exerciseId,
          name,
          muscleGroup,
          kind: derivedKind,
          sets: 0,
          id: exerciseId,
          label: name
        };
      };

      const buildSessionItemsFromIds = (ids = [], baseItems = []) => {
        return ids.map(id => {
          const existing = baseItems.find(item => item.exerciseId === id || item.id === id);
          if (existing) {
            const name = EQUIPMENT_DB[id]?.name || existing.name || existing.label || 'Exercise';
            const muscleGroup = existing.muscleGroup || EQUIPMENT_DB[id]?.target || '';
            const derivedKind = EQUIPMENT_DB[id]?.type === 'cardio' ? 'cardio' : (existing.kind || 'strength');
            return { ...existing, exerciseId: id, id, name, label: name, kind: derivedKind, muscleGroup };
          }
          return buildSessionItem(id);
        });
      };

      const updateDraftPlanExercises = (updater) => {
        setDraftPlan(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          const nextExercises = updater(prev.exercises || []);
          return { ...prev, exercises: nextExercises };
        });
      };

      const updateActiveSession = (entry, setsList = null) => {
        if (!entry?.id) return;
        setActiveSession(prev => {
          const base = (!prev || prev.date !== todayKey) ? createEmptySession({ createdFrom: 'manual' }) : prev;
          const items = [...(base.items || [])];
          const logsByExercise = { ...(base.logsByExercise || {}) };
          const idx = items.findIndex(item => (item.exerciseId || item.id) === entry.id);
          const resolvedSets = Array.isArray(setsList)
            ? setsList
            : (Array.isArray(logsByExercise[entry.id]) ? logsByExercise[entry.id] : Array.from({ length: entry.sets || 0 }, () => ({ reps: null, weight: null })));
          logsByExercise[entry.id] = resolvedSets;
          const name = entry.name || entry.label || EQUIPMENT_DB[entry.id]?.name || 'Exercise';
          const updatedItem = {
            ...(idx >= 0 ? items[idx] : buildSessionItem(entry.id, entry.kind || 'strength')),
            exerciseId: entry.id,
            id: entry.id,
            name,
            label: name,
            kind: entry.kind || (idx >= 0 ? items[idx].kind : 'strength'),
            muscleGroup: entry.muscleGroup || (idx >= 0 ? items[idx].muscleGroup : null) || EQUIPMENT_DB[entry.id]?.target || '',
            sets: resolvedSets.length
          };
          if (idx >= 0) items[idx] = updatedItem;
          else items.push(updatedItem);
          return {
            ...base,
            status: base.status,
            items,
            logsByExercise
          };
        });
      };

      const updateSessionLogs = (exerciseId, sets) => {
        if (!exerciseId) return;
        
        // Easter egg: Check for 69 or 420 in weight
        sets.forEach(set => {
          if (set.weight === 69 || set.weight === 420 || set.weight === '69' || set.weight === '420') {
            setShowNice(true);
            setTimeout(() => setShowNice(false), 2000);
          }
        });
        
        updateActiveSession({
          id: exerciseId,
          name: EQUIPMENT_DB[exerciseId]?.name || 'Exercise',
          kind: EQUIPMENT_DB[exerciseId]?.type === 'cardio' ? 'cardio' : 'strength'
        }, sets);
      };

      const ensureWorkoutDayEntry = (exercises = []) => {
        if (!profile.onboarded) return;
        recordDayEntry(todayKey, 'workout', { exercises: Array.from(new Set([...(dayEntries[todayKey]?.exercises || []), ...exercises])) });
      };

      const removeExerciseLogsForToday = (exerciseId, kind = 'strength') => {
        if (kind === 'cardio' && exerciseId.startsWith('cardio_')) {
          const cardioType = exerciseId.replace('cardio_', '');
          setCardioHistory(prev => {
            const existing = prev[cardioType] || [];
            const updated = existing.filter(s => toDayKey(new Date(s.date)) !== todayKey);
            if (updated.length === existing.length) return prev;
            return { ...prev, [cardioType]: updated };
          });
        }
        setHistory(prev => {
          const existing = prev[exerciseId] || [];
          const updated = existing.filter(s => toDayKey(new Date(s.date)) !== todayKey);
          if (updated.length === existing.length) return prev;
          return { ...prev, [exerciseId]: updated };
        });
        setDayEntries(prev => {
          const todayEntry = prev[todayKey];
          if (!todayEntry?.exercises) return prev;
          const updated = todayEntry.exercises.filter(id => id !== exerciseId);
          if (updated.length === todayEntry.exercises.length) return prev;
          return { ...prev, [todayKey]: { ...todayEntry, exercises: updated } };
        });
      };

      const createEmptyDraft = () => {
        createDraft({ label: 'Workout Draft', exercises: [], createdFrom: 'manual', type: todayWorkoutType });
        updateSessionItemsByIds([], { status: 'draft', createdFrom: 'manual' });
        setFocusDraft(true);
      };

      const finishActiveSession = () => {
        if (!activeSession) return;
        const hasData = Object.values(activeSession.logsByExercise || {}).some(sets => (sets || []).length > 0);
        if (activeSession.status !== 'active' && !hasData) return;
        debugLog('workout_finish', { date: todayKey });
        const sessionDate = new Date().toISOString();
        const logsByExercise = activeSession.logsByExercise || {};
        const sessionExercises = activeSession.items || [];
        sessionExercises.forEach(item => {
          const exerciseId = item.exerciseId || item.id;
          const logs = logsByExercise[exerciseId] || [];
          if (!logs.length) return;
          if (item.kind === 'cardio') {
            handleSaveCardioSession(exerciseId, logs);
          } else {
            handleSaveSession(exerciseId, { date: sessionDate, type: 'strength', sets: logs }, { quiet: true });
          }
        });
        recordDayEntry(todayKey, 'workout', { exercises: sessionExercises.map(item => item.exerciseId || item.id) });
        setActiveSession(null);
        setDraftPlan(null);
        setDismissedDraftDate(null);
        setActiveEquipment(null);
        setActiveCardio(null);
        setSessionStartNotice(null);
        const chosenQuote = getRandomQuote(postWorkoutQuotes);
        setPostWorkoutQuote(chosenQuote);
        setShowPostWorkout(true);
        setShowPostWorkoutCelebration(true);
        if (postWorkoutCelebrationRef.current) clearTimeout(postWorkoutCelebrationRef.current);
        postWorkoutCelebrationRef.current = setTimeout(() => setShowPostWorkoutCelebration(false), 720);
        if (postWorkoutTimerRef.current) clearTimeout(postWorkoutTimerRef.current);
        postWorkoutTimerRef.current = setTimeout(() => setShowPostWorkout(false), 3600);
        setTab('home');
        pushMessage(COPY_PUSH.workoutSaved);
        showToast('Session saved. Future you says thanks.');
      };

      const buildDraftPlan = (type, options = {}) => {
        const gymType = GYM_TYPES[profile.gymType];
        const planKey = type === 'legs' ? 'Legs' : type === 'push' ? 'Push' : type === 'pull' ? 'Pull' : type === 'full' ? 'Full Body' : todayWorkoutType;
        const planLabel = planKey === 'Full Body' ? 'Full Body' : `${planKey} Day`;
        const plan = WORKOUT_PLANS[planKey] || {};
        const pool = [];
        const wantsMachines = options.equipment === 'machines';
        const wantsFree = options.equipment === 'free';
        const allowMachines = gymType?.machines && !wantsFree;
        const allowFree = (gymType?.dumbbells?.available || gymType?.barbells?.available) && !wantsMachines;
        if (allowMachines) pool.push(...(plan.machines || []));
        if (allowFree && gymType?.dumbbells?.available) pool.push(...(plan.dumbbells || []));
        if (allowFree && gymType?.barbells?.available) pool.push(...(plan.barbells || []));
        const uniquePool = Array.from(new Set(pool));
        if (uniquePool.length === 0) {
          uniquePool.push(...Object.keys(EQUIPMENT_DB).slice(0, 12));
        }
        const targetCount = options.duration === 30 ? 3 : options.duration === 60 ? 5 : 4;
        while (uniquePool.length < targetCount) {
          const fallback = Object.keys(EQUIPMENT_DB).filter(id => (EQUIPMENT_DB[id]?.tags || []).includes(planKey.toLowerCase()) || EQUIPMENT_DB[id]?.tags?.includes(planKey));
          if (fallback.length === 0) {
            uniquePool.push(...Object.keys(EQUIPMENT_DB).filter(id => uniquePool.indexOf(id) === -1).slice(0, targetCount - uniquePool.length));
          } else {
            uniquePool.push(...fallback);
          }
          uniquePool.splice(targetCount);
          if (uniquePool.length >= targetCount || fallback.length === 0) break;
        }
        const picks = [];
        const poolCopy = [...uniquePool];
        for (let i = 0; i < targetCount && poolCopy.length > 0; i++) {
          const idx = Math.floor(Math.random() * poolCopy.length);
          picks.push(poolCopy.splice(idx, 1)[0]);
        }
        const sanitizedOptions = {
          goal: options.goal || '',
          duration: options.duration || '',
          equipment: options.equipment || ''
        };
        return { type, label: planLabel, exercises: picks, options: sanitizedOptions };
      };

      const createDraft = (draft) => {
        const resolved = {
          date: todayKey,
          label: draft?.label || 'Workout Draft',
          exercises: draft?.exercises || [],
          options: draft?.options || {},
          status: 'draft',
          createdFrom: draft?.createdFrom || 'manual',
          type: draft?.type || todayWorkoutType
        };
        setDraftPlan(resolved);
        setDismissedDraftDate(null);
      };

      const triggerGenerator = (type) => {
        if (isRestDay) {
          setTab('home');
          return;
        }
        if (activeSessionToday?.status === 'active') {
          setTab('workout');
          return;
        }
        const chosen = type === 'surprise' ? ['legs','push','pull','full'][Math.floor(Math.random()*4)] : type;
        const draft = buildDraftPlan(chosen, generatorOptions || {});
        updateSessionItemsByIds(draft.exercises || [], { status: 'draft', createdFrom: 'generated' });
        showToast('Added to today’s workout');
        setTab('workout');
      };

      const regenerateDraftPlan = () => {
        if (!draftPlan) return;
        const hasOptions = generatorOptions?.goal || generatorOptions?.duration || generatorOptions?.equipment;
        const regenerated = buildDraftPlan(draftPlan.type, hasOptions ? generatorOptions : (draftPlan.options || {}));
        createDraft({ ...regenerated, createdFrom: 'generated' });
        updateSessionItemsByIds(regenerated.exercises || [], {
          status: activeSessionToday?.status === 'active' ? 'active' : 'draft',
          createdFrom: 'generated'
        });
      };

      const swapDraftExercise = (index, newId) => {
        const currentId = draftPlanToday?.exercises?.[index];
        const existingEntry = activeSessionToday?.items?.find(item => (item.exerciseId || item.id) === currentId);
        if (existingEntry?.sets > 0) {
          const confirmed = window.confirm('This will remove logged sets for this exercise from today’s session.');
          if (!confirmed) return;
          removeExerciseLogsForToday(currentId, existingEntry.kind);
        }
        setDraftPlan(prev => {
          if (!prev) return prev;
          const updated = [...prev.exercises];
          updated[index] = newId;
          return { ...prev, exercises: updated };
        });
        setActiveSession(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          const items = [...(prev.items || [])];
          const logsByExercise = { ...(prev.logsByExercise || {}) };
          if (items[index]) {
            items[index] = buildSessionItem(newId);
          } else if (currentId) {
            const idx = items.findIndex(item => item.id === currentId);
            if (idx >= 0) {
              items[idx] = buildSessionItem(newId);
            }
          }
          if (currentId) delete logsByExercise[currentId];
          if (!logsByExercise[newId]) logsByExercise[newId] = [];
          return { ...prev, items, logsByExercise };
        });
      };

      const removeDraftExercise = (index) => {
        const currentId = draftPlanToday?.exercises?.[index];
        const existingEntry = activeSessionToday?.items?.find(item => (item.exerciseId || item.id) === currentId);
        if (existingEntry?.sets > 0) {
          const confirmed = window.confirm('This will remove logged sets for this exercise from today’s session.');
          if (!confirmed) return;
          removeExerciseLogsForToday(currentId, existingEntry.kind);
        }
        setDraftPlan(prev => {
          if (!prev) return prev;
          const updated = prev.exercises.filter((_, idx) => idx !== index);
          return { ...prev, exercises: updated };
        });
        if (currentId) {
          setActiveSession(prev => {
            if (!prev || prev.date !== todayKey) return prev;
            const logsByExercise = { ...(prev.logsByExercise || {}) };
            delete logsByExercise[currentId];
            return { ...prev, items: (prev.items || []).filter(item => (item.exerciseId || item.id) !== currentId), logsByExercise };
          });
        }
      };

      const clearDraftPlan = () => {
        setDraftPlan(null);
        setDismissedDraftDate(null);
        if (activeSessionToday) {
          updateSessionItemsByIds([], {
            status: activeSessionToday?.status === 'active' ? 'active' : 'draft',
            createdFrom: 'manual'
          });
        }
      };

      const logRestDay = () => {
        debugLog('rest_day', { date: todayKey });
        setAppState(prev => {
          const restDays = new Set(prev?.restDays || []);
          restDays.add(todayKey);
          return { ...(prev || {}), restDays: Array.from(restDays) };
        });
        recordDayEntry(todayKey, 'rest');
        setActiveSession(null);
        setDraftPlan(null);
        setDismissedDraftDate(null);
        setActiveEquipment(null);
        setActiveCardio(null);
        setTab('workout');
        pushMessage(COPY_PUSH.restDayLogged);
      };

      const undoRestDay = () => {
        setAppState(prev => {
          const restDays = (prev?.restDays || []).filter(day => day !== todayKey);
          return { ...(prev || {}), restDays };
        });
        setDayEntries(prev => {
          const entry = prev[todayKey];
          if (!entry || entry.type !== 'rest') return prev;
          const next = { ...prev };
          delete next[todayKey];
          return next;
        });
        pushMessage(COPY_PUSH.restDayRemoved);
      };

      const applyTemplatePlan = (plan) => {
        if (!plan) return;
        if (isRestDay) {
          undoRestDay();
        }

        const exerciseIds = (plan.exercises || [])
          .map((ex) => ex.id || ex.key || ex.name)
          .filter(Boolean);

        if (!exerciseIds.length) return;

        const nextStatus = activeSessionToday?.status === 'active' ? 'active' : 'draft';

        updateSessionItemsByIds(exerciseIds, {
          status: nextStatus,
          createdFrom: 'generated'
        });

        setDraftPlan({
          date: todayKey,
          label: plan.name || 'Workout Template',
          exercises: exerciseIds,
          options: {},
          status: nextStatus,
          createdFrom: 'generated',
          type: todayWorkoutType
        });

        setDismissedDraftDate(null);
      };

      const startWorkoutFromBuilder = () => {
        if (isRestDay || !activeSessionToday) return;
        ensureWorkoutDayEntry((activeSessionToday.items || []).map(item => item.exerciseId || item.id));
        setActiveSession(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          return { ...prev, status: 'active' };
        });
        debugLog('workout_start', { date: todayKey });
      };

      const handleStartWorkout = () => {
        if (isRestDay) {
          undoRestDay();
        }
        setTab('workout');
        if (activeSessionToday?.status === 'active') {
          return;
        }
        if (!activeSessionToday) {
          startEmptySession();
        }
      };

      const handleOpenHistoryFromHome = () => {
        setHomeRequestedAnalyticsTab('history');
        setShowPatterns(false);
        setShowMuscleMap(false);
        setShowAnalytics(true);
      };

      const handleOpenSettingsFromHome = () => setTab('profile');

      const startEmptySession = () => {
        if (isRestDay) {
          undoRestDay();
        }
        setActiveSession(prev => {
          const base = (!prev || prev.date !== todayKey) ? createEmptySession({ createdFrom: 'manual' }) : prev;
          return { ...base, status: 'draft' };
        });
      };

      const cancelTodaySession = (isActive = false, hasLoggedSets = false) => {
        if (hasLoggedSets) {
          const confirmed = window.confirm('Discard today’s session? Your logged sets will be cleared.');
          if (!confirmed) return;
        } else if (isActive) {
          const confirmed = window.confirm('Cancel this workout?');
          if (!confirmed) return;
        }
        setActiveSession(null);
        setDraftPlan(null);
        setDismissedDraftDate(null);
        setActiveEquipment(null);
        setActiveCardio(null);
        setSessionStartNotice(null);
      };

      const addExerciseToDraft = (id) => {
        if (!id) return;
        addExerciseToSession(id, { status: activeSessionToday?.status || 'draft' });
      };

      const addExerciseToSession = (id, options = {}) => {
        if (isRestDay) return;
        if (!id) return;
        if (!activeSessionToday) return;
        let didAdd = false;
        setActiveSession(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          const base = prev;
          const items = [...(base.items || [])];
          const logsByExercise = { ...(base.logsByExercise || {}) };
          if (!items.find(item => (item.exerciseId || item.id) === id)) {
            items.push(buildSessionItem(id));
            logsByExercise[id] = [];
            didAdd = true;
          }
          const nextStatus = options.status || base.status;
          return { ...base, status: nextStatus, createdFrom: base.createdFrom || options.createdFrom || 'manual', items, logsByExercise };
        });
        if (options.toast && didAdd) {
          showToast('Exercise added');
        }
        if (didAdd) {
          debugLog('exercise_add', { id });
        }
      };

      const addExerciseFromSearch = (id) => {
        if (isRestDay) return;
        if (!id) return;
        
        if (id === 'kung_fu') {
          setShowMatrix(true);
          return;
        }
        
        if (id === 'power_up') {
          setShowPowerUp(true);
          return;
        }
        
        addExerciseToSession(id, { status: activeSessionToday?.status === 'active' ? 'active' : 'draft', toast: true });
      };

      const handleSelectExercise = (id, mode, options = {}) => {
        if (isRestDay) return;
        if (options.createDraftOnly) {
          createEmptyDraft();
          return;
        }
        if (!id) return;
        if (!activeSessionToday) return;
        if (activeSessionToday?.status !== 'active') return;
        if (EQUIPMENT_DB[id]?.comingSoon) return;
        if (mode === 'session') {
          if (!activeSessionToday?.items?.some(item => (item.exerciseId || item.id) === id)) return;
          const entry = activeSessionToday?.items?.find(item => (item.exerciseId || item.id) === id);
          if (activeEquipment === id || activeCardio === id) {
            setActiveEquipment(null);
            setActiveCardio(null);
            return;
          }
          if (entry?.kind === 'cardio') {
            setActiveEquipment(null);
            setActiveCardio(id);
          } else {
            setActiveCardio(null);
            setActiveEquipment(id);
            setPendingAutoFocusExercise(id);
          }
          return;
        }
      };

      const removeSessionExercise = (id) => {
        if (!id || !activeSessionToday) return;
        const entryIndex = activeSessionToday.items?.findIndex(item => (item.exerciseId || item.id) === id);
        const entry = activeSessionToday.items?.[entryIndex];
        const logs = activeSessionToday.logsByExercise?.[id] || [];
        const draftIndex = draftPlanToday?.exercises?.findIndex(exId => exId === id);
        const hadDraftEntry = Number.isInteger(draftIndex) && draftIndex >= 0;
        setActiveSession(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          const logsByExercise = { ...(prev.logsByExercise || {}) };
          delete logsByExercise[id];
          return { ...prev, items: (prev.items || []).filter(item => (item.exerciseId || item.id) !== id), logsByExercise };
        });
        updateDraftPlanExercises(prev => prev.filter(exId => exId !== id));
        showUndoToast({
          message: 'Removed.',
          onUndo: () => {
            setActiveSession(prev => {
              if (!prev || prev.date !== todayKey) return prev;
              const items = [...(prev.items || [])];
              const logsByExercise = { ...(prev.logsByExercise || {}) };
              if (!items.some(item => (item.exerciseId || item.id) === id)) {
                const insertAt = Number.isInteger(entryIndex) ? entryIndex : items.length;
                const restoredEntry = entry || buildSessionItem(id);
                items.splice(Math.min(insertAt, items.length), 0, restoredEntry);
              }
              logsByExercise[id] = logs;
              return { ...prev, items, logsByExercise };
            });
            if (hadDraftEntry) {
              updateDraftPlanExercises(prev => {
                if (prev.includes(id)) return prev;
                const next = [...prev];
                const insertAt = Number.isInteger(draftIndex) ? draftIndex : next.length;
                next.splice(Math.min(insertAt, next.length), 0, id);
                return next;
              });
            }
          },
          onCommit: () => {
            if (logs.length > 0) {
              removeExerciseLogsForToday(id, entry?.kind || 'strength');
            }
          }
        });
      };

      const swapSessionExercise = (index, newId) => {
        if (!activeSessionToday) return;
        const entry = activeSessionToday.items?.[index];
        if (!entry) return;
        const entryId = entry.exerciseId || entry.id;
        if ((activeSessionToday.logsByExercise?.[entryId] || []).length > 0) {
          const confirmed = window.confirm('This will remove logged sets for this exercise from today’s session.');
          if (!confirmed) return;
          removeExerciseLogsForToday(entry.id, entry.kind);
        }
        setActiveSession(prev => {
          if (!prev || prev.date !== todayKey) return prev;
          const items = [...(prev.items || [])];
          const logsByExercise = { ...(prev.logsByExercise || {}) };
          if (!items[index]) return prev;
          const oldId = items[index].exerciseId || items[index].id;
          items[index] = buildSessionItem(newId);
          if (oldId) delete logsByExercise[oldId];
          if (!logsByExercise[newId]) logsByExercise[newId] = [];
          return { ...prev, items, logsByExercise };
        });
        updateDraftPlanExercises(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = newId;
            return updated;
          }
          const fallbackIndex = updated.findIndex(exId => exId === entry.id);
          if (fallbackIndex >= 0) updated[fallbackIndex] = newId;
          return updated;
        });
      };

      const handleSaveSession = (id, session, options = {}) => {
        if (isRestDay) return;
        if (!session) return;
        const normalizedSession = {
          ...session,
          sets: [...(session.sets || [])]
        };
        const sessionDay = toDayKey(new Date(session.date));
        const previousSessions = Array.isArray(history[id]) ? history[id] : [];
        const lastSession = previousSessions[previousSessions.length - 1];
        const lastMaxWeight = lastSession?.sets?.length ? Math.max(...lastSession.sets.map(s => s.weight || 0)) : null;
        const lastTotalReps = lastSession?.sets?.length ? lastSession.sets.reduce((sum, s) => sum + (s.reps || 0), 0) : null;
        const newMaxWeight = normalizedSession?.sets?.length ? Math.max(...normalizedSession.sets.map(s => s.weight || 0)) : null;
        const newTotalReps = normalizedSession?.sets?.length ? normalizedSession.sets.reduce((sum, s) => sum + (s.reps || 0), 0) : null;
        setHistory(prev => {
          const prevSessions = prev[id] || [];
          const existingIdx = prevSessions.findIndex(s => toDayKey(new Date(s.date)) === sessionDay);
          const updated = [...prevSessions];
          if (existingIdx >= 0) updated[existingIdx] = normalizedSession;
          else updated.push(normalizedSession);
          return { ...prev, [id]: updated };
        });

        setAppState(prev => ({
          ...prev,
          lastWorkoutType: todayWorkoutType,
          lastWorkoutDayKey: toDayKey(new Date())
        }));

        // Unlock beginner mode after first workoutrecordExerciseUse(id, session.sets || []);
        recordDayEntry(sessionDay, 'workout', { exercises: Array.from(new Set([...(dayEntries[sessionDay]?.exercises || []), id])) });
        updateActiveSession({
          id,
          name: EQUIPMENT_DB[id]?.name || 'Exercise',
          kind: 'strength'
        }, normalizedSession.sets || []);

        // Only close modal if not explicitly told to keep it open (e.g., from cleanup/auto-save)
        if (!options.keepOpen) {
          setActiveEquipment(null);
        }
        if (!options.quiet) {
          if (settings.insightsEnabled !== false && lastSession && newMaxWeight !== null) {
            const improved = newMaxWeight > (lastMaxWeight || 0) || (newMaxWeight === lastMaxWeight && newTotalReps > (lastTotalReps || 0));
            if (improved) {
              const responses = ['More than last time.', 'That’s progress.'];
              pushMessage(responses[Math.floor(Math.random() * responses.length)]);
            } else {
              pushMessage(COPY_PUSH.workoutSaved);
            }
          } else {
            pushMessage(COPY_PUSH.workoutSaved);
          }
        }
        // Stay on suggested workout screen if user is there
      };

      const handleSaveCardioSession = (exerciseId, entries = []) => {
        if (isRestDay) return;
        if (!exerciseId) return;
        const eq = EQUIPMENT_DB[exerciseId];
        const cardioType = exerciseId.startsWith('cardio_') ? exerciseId.replace('cardio_', '') : exerciseId;
        const totalMinutes = entries.reduce((sum, entry) => sum + (entry.durationMin || entry.minutes || 0), 0);
        const session = {
          date: new Date().toISOString(),
          type: 'cardio',
          entries: [...entries],
          duration: totalMinutes || null,
          cardioLabel: eq?.name || 'Cardio',
          cardioType,
          cardioGroup: eq?.cardioGroup || null
        };
        setHistory(prev => {
          const prevSessions = prev[exerciseId] || [];
          const sessionDay = toDayKey(new Date(session.date));
          const existingIdx = prevSessions.findIndex(s => toDayKey(new Date(s.date)) === sessionDay);
          const updated = [...prevSessions];
          if (existingIdx >= 0) updated[existingIdx] = session;
          else updated.push(session);
          return { ...prev, [exerciseId]: updated };
        });
        if (exerciseId.startsWith('cardio_')) {
          setCardioHistory(prev => {
            const prevSessions = prev[cardioType] || [];
            const sessionDay = toDayKey(new Date(session.date));
            const existingIdx = prevSessions.findIndex(s => toDayKey(new Date(s.date)) === sessionDay);
            const updated = [...prevSessions];
            if (existingIdx >= 0) updated[existingIdx] = session;
            else updated.push(session);
            return { ...prev, [cardioType]: updated };
          });
        }
        recordDayEntry(todayKey, 'workout', {
          exercises: Array.from(new Set([...(dayEntries[todayKey]?.exercises || []), exerciseId]))
        });
      };

      const handleReset = () => {
        if(confirm("Reset all data? This can't be undone.")) {
          const freshProfile = { 
            username: '', 
            avatar: '💪', 
            workoutLocation: 'gym',
            gymType: 'commercial',
            barWeight: 45,
            onboarded: false,
          };
          setProfile(freshProfile);
          setHistory({});
          setCardioHistory({});
          setActiveSession(null);
          setView('onboarding');
          setTab('home');
          setAppState({ lastWorkoutType: null, lastWorkoutDayKey: null, restDays: [] });
          setSettings({ ...SETTINGS_DEFAULTS });
          setPinnedExercises([]);
          setStarredExercises([]);
          setColorfulExerciseCards(true);
          setRecentExercises([]);
          setExerciseUsageCounts({});
          setDayEntries({});
          setLastExerciseStats({});
          setDraftPlan(null);
          setDismissedDraftDate(null);
          setHasSeenCoachModeNudge(false);
          setShowCoachModeNudge(false);
          storage.set('ps_v2_profile', null);
          storage.set('ps_v2_history', {});
          storage.set('ps_v2_cardio', {});
          storage.set('ps_v2_state', { lastWorkoutType: null, lastWorkoutDayKey: null, restDays: [] });
          storage.set('ps_v2_settings', { ...SETTINGS_DEFAULTS });
          storage.set(STORAGE_KEY, { version: STORAGE_VERSION, pinnedExercises: [], recentExercises: [], exerciseUsageCounts: {}, dayEntries: {}, lastExerciseStats: {} });
          storage.set(ONBOARDING_KEY, false);
          storage.set('ps_dismissed_draft_date', null);
          storage.set(ACTIVE_SESSION_KEY, null);
          storage.set(DRAFT_SESSION_KEY, null);
          storage.set(TODAY_WORKOUT_KEY, null);
          storage.set(TODAY_SESSION_KEY, null);
          storage.set(REST_DAY_KEY, []);
          try {
            localStorage.setItem('ps_starredExercises', JSON.stringify([]));
            localStorage.setItem('ps_colorfulExerciseCards', JSON.stringify(true));
          } catch {
            return;
          }
        }
      };

      const handleResetOnboarding = () => {
        storage.set(ONBOARDING_KEY, false);
        setProfile(prev => ({ ...prev, onboarded: false }));
        setView('onboarding');
      };

      const completeOnboarding = () => {
        setProfile(prev => ({
          ...prev,
          onboarded: true,
          workoutLocation: prev.workoutLocation || 'gym',
          gymType: prev.gymType || 'commercial'
        }));
        storage.set(ONBOARDING_KEY, true);
        setView('app');
        setTab('home');
      };

      const handleExportData = () => {
        try {
          const exportData = {
            version: 'v2',
            exportDate: new Date().toISOString(),
            profile,
            settings,
            history,
            cardioHistory,
            appState,
            restDayDates: appState?.restDays || [],
            meta: {
              version: STORAGE_VERSION,
              pinnedExercises,
              recentExercises,
              exerciseUsageCounts,
              dayEntries,
              lastExerciseStats
            }
          };

          const dataStr = JSON.stringify(exportData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `planet-strength-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          alert('✅ Data exported successfully! Your backup file has been downloaded.');
        } catch (error) {
          alert('❌ Export failed: ' + error.message);
        }
      };

      const handleImportData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const importedData = JSON.parse(event.target.result);
              const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

              // Validate the imported data
              if (!isPlainObject(importedData)
                || !isPlainObject(importedData.profile)
                || !isPlainObject(importedData.settings)
                || !isPlainObject(importedData.history)
                || !isPlainObject(importedData.cardioHistory)
              ) {
                alert('❌ Invalid backup file format.');
                return;
              }

              if (confirm('⚠️ Import will replace all current data. Continue?')) {
                // Restore all data
                if (importedData.profile) {
                  setProfile(importedData.profile);
                  storage.set('ps_v2_profile', importedData.profile);
                }
                if (importedData.settings) {
                  const mergedSettings = { ...SETTINGS_DEFAULTS, ...importedData.settings };
                  setSettings(mergedSettings);
                  storage.set('ps_v2_settings', mergedSettings);
                }
                if (importedData.history) {
                  setHistory(importedData.history);
                  storage.set('ps_v2_history', importedData.history);
                }
                if (importedData.cardioHistory) {
                  setCardioHistory(importedData.cardioHistory);
                  storage.set('ps_v2_cardio', importedData.cardioHistory);
                }
                if (importedData.appState || importedData.restDayDates) {
                  const restDays = Array.isArray(importedData?.restDayDates)
                    ? importedData.restDayDates
                    : (Array.isArray(importedData?.appState?.restDays) ? importedData.appState.restDays : []);
                  const nextAppState = {
                    lastWorkoutType: importedData.appState?.lastWorkoutType || null,
                    lastWorkoutDayKey: importedData.appState?.lastWorkoutDayKey || null,
                    restDays
                  };
                  setAppState(nextAppState);
                  storage.set('ps_v2_state', nextAppState);
                  storage.set(REST_DAY_KEY, restDays);
                } else {
                  const nextAppState = { lastWorkoutType: null, lastWorkoutDayKey: null, restDays: [] };
                  setAppState(nextAppState);
                  storage.set('ps_v2_state', nextAppState);
                  storage.set(REST_DAY_KEY, []);
                }
                if (importedData.meta) {
                  const meta = {
                    version: STORAGE_VERSION,
                    pinnedExercises: importedData.meta.pinnedExercises || [],
                    recentExercises: importedData.meta.recentExercises || [],
                    exerciseUsageCounts: importedData.meta.exerciseUsageCounts || {},
                    dayEntries: importedData.meta.dayEntries || {},
                    lastExerciseStats: importedData.meta.lastExerciseStats || {}
                  };
                  setPinnedExercises(meta.pinnedExercises);
                  setRecentExercises(meta.recentExercises);
                  setExerciseUsageCounts(meta.exerciseUsageCounts);
                  setDayEntries(meta.dayEntries);
                  setLastExerciseStats(meta.lastExerciseStats);
                  storage.set(STORAGE_KEY, meta);
                } else {
                  const derivedMeta = {
                    version: STORAGE_VERSION,
                    pinnedExercises: importedData.settings?.pinnedExercises || [],
                    recentExercises: deriveRecentExercises(importedData.history || {}),
                    exerciseUsageCounts: deriveUsageCountsFromHistory(importedData.history || {}),
                    dayEntries: buildDayEntriesFromHistory(
                      importedData.history || {},
                      importedData.cardioHistory || {},
                      Array.isArray(importedData?.restDayDates)
                        ? importedData.restDayDates
                        : (importedData.appState?.restDays || [])
                    ),
                    lastExerciseStats: {}
                  };
                  setPinnedExercises(derivedMeta.pinnedExercises);
                  setRecentExercises(derivedMeta.recentExercises);
                  setExerciseUsageCounts(derivedMeta.exerciseUsageCounts);
                  setDayEntries(derivedMeta.dayEntries);
                  setLastExerciseStats(derivedMeta.lastExerciseStats);
                  storage.set(STORAGE_KEY, derivedMeta);
                }

                alert('✅ Data imported successfully! Your backup has been restored.');
              }
            } catch (error) {
              alert('❌ Import failed: Invalid JSON file or corrupted data.');
            }
          };
          reader.readAsText(file);
        };

        input.click();
      };

      if (!loaded) return null;if (view === 'onboarding') return <OnboardingFlow profile={profile} setProfile={setProfile} onFinish={completeOnboarding} />;

      
return (
        <>
          <InstallPrompt />
          {shouldShowLockedInGate && (
            <LockedInGate
              onLockedIn={() => setLockedInDismissed(true)}
              onBrowse={() => setLockedInDismissed(true)}
            />
          )}
          <div className="app-root bg-gray-50 flex flex-col overflow-hidden">
            <div className="app-main">
              <InlineMessage message={tab === 'home' && inlineMessage === 'Workout saved.' ? null : inlineMessage} />
              <UndoToast message={undoToast?.message} onUndo={handleUndoAction} />
              <ToastHost toasts={toasts} />
              {showPostWorkout && (
                <div className="post-workout-screen" onClick={() => setShowPostWorkout(false)}>
                  <div
                    className={`post-workout-card ${showPostWorkoutCelebration ? 'post-workout-celebrate' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="post-workout-header">
                      <div className="text-xs font-bold text-gray-400 uppercase">Session</div>
                      <button className="post-workout-close" onClick={() => setShowPostWorkout(false)}>
                        <Icon name="X" className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-2xl font-black text-gray-900">Workout saved.</div>
                    {postWorkoutQuote && (
                      <div className="quote-block subtle">
                        <p className="quote-text">“{postWorkoutQuote.text}”</p>
                        <p className="quote-meta">— {postWorkoutQuote.movie}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="page-stack">
                <div className={`page ${showAnalytics ? 'active' : ''}`} aria-hidden={!showAnalytics}>
                  <div className="h-full flex flex-col bg-gray-50">
                    <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
                      <button onClick={() => setShowAnalytics(false)} className="p-2 rounded-full bg-gray-100">
                        <Icon name="ChevronLeft" className="w-5 h-5 text-gray-700" />
                      </button>
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase">Analytics</div>
                        <div className="text-lg font-black text-gray-900">Progress</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <Progress
                        profile={profile}
                        history={effectiveHistory}
                        strengthScoreObj={strengthScoreObj}
                        cardioHistory={effectiveCardioHistory}
                        initialAnalyticsTab={homeRequestedAnalyticsTab || 'overview'}
                      />
                    </div>
                  </div>
                </div>
                <div className={`page ${showPatterns ? 'active' : ''}`} aria-hidden={!showPatterns}>
                  <PatternsScreen
                    history={effectiveHistory}
                    cardioHistory={effectiveCardioHistory}
                    onClose={() => setShowPatterns(false)}
                  />
                </div>
                <div className={`page ${showMuscleMap ? 'active' : ''}`} aria-hidden={!showMuscleMap}>
                  <MuscleMapScreen
                    history={effectiveHistory}
                    onClose={() => setShowMuscleMap(false)}
                  />
                </div>
                <div className={`page ${!showAnalytics && !showPatterns && !showMuscleMap && tab === 'home' ? 'active' : ''}`} aria-hidden={showAnalytics || showPatterns || showMuscleMap || tab !== 'home'}>
                  <Home
                    profile={profile}
                    lastWorkoutLabel={lastWorkoutLabel}
                    lastSessionSummary={lastSessionSummary}
                    lastSessionShortLabel={lastSessionShortLabel}
                    lastSessionDetail={lastSessionDetail}
                    suggestedFocus={suggestedFocus}
                    dayEntries={effectiveDayEntries}
                    lastWorkoutDate={lastWorkoutDate}
                    onStartWorkout={handleStartWorkout}
                    homeQuote={homeQuote}
                    coachMessage={coachMessage}
                    isRestDay={isRestDay}
                    sessionIntent={sessionIntent}
                    onLogRestDay={logRestDay}
                    onUndoRestDay={undoRestDay}
                    onTriggerGlory={() => setShowGlory(true)}
                    onLongPressRestDay={() => setShowButDidYouDie(true)}
                    onOpenTemplatesFromHome={() => {
                      setTab('workout');
                      setOpenTemplatesFromHome(true);
                    }}
                    onOpenHistoryFromHome={handleOpenHistoryFromHome}
                    onOpenSettingsFromHome={handleOpenSettingsFromHome}
                  />
                </div>
                <div className={`page ${!showAnalytics && !showPatterns && !showMuscleMap && tab === 'workout' ? 'active' : ''}`} aria-hidden={showAnalytics || showPatterns || showMuscleMap || tab !== 'workout'}>
                  <Workout
                    profile={profile}
                    history={effectiveHistory}
                    cardioHistory={effectiveCardioHistory}
                    colorfulExerciseCards={colorfulExerciseCards}
                    onSelectExercise={handleSelectExercise}
                    settings={settings}
                    setSettings={setSettings}
                    pinnedExercises={pinnedExercises}
                    setPinnedExercises={setPinnedExercises}
                    recentExercises={recentExercises}
                    starredExercises={starredExercises}
                    onToggleStarred={toggleStarredExercise}
                    exerciseUsageCounts={exerciseUsageCounts}
                    onStartWorkoutFromBuilder={startWorkoutFromBuilder}
                    activeSession={activeSessionToday}
                    onFinishSession={finishActiveSession}
                    onAddExerciseFromSearch={addExerciseFromSearch}
                    onPushMessage={pushMessage}
                    onRemoveSessionExercise={removeSessionExercise}
                    onSwapSessionExercise={swapSessionExercise}
                    onStartEmptySession={startEmptySession}
                    isRestDay={isRestDay}
                    onCancelSession={cancelTodaySession}
                    sessionIntent={sessionIntent}
                    onApplyTemplate={applyTemplatePlan}
                    openTemplatesFromHome={openTemplatesFromHome}
                    onConsumedOpenTemplatesFromHome={() => setOpenTemplatesFromHome(false)}
                    onOpenSettings={() => setTab('profile')}
                    onToggleRestDay={isRestDay ? undoRestDay : logRestDay}
                  />
                </div>
                <div className={`page ${!showAnalytics && !showPatterns && !showMuscleMap && tab === 'profile' ? 'active' : ''}`} aria-hidden={showAnalytics || showPatterns || showMuscleMap || tab !== 'profile'}>
                  <ProfileView
                    settings={settings}
                    setSettings={setSettings}
                    themeMode={themeMode}
                    darkVariant={darkVariant}
                    setThemeMode={setThemeMode}
                    setDarkVariant={setDarkVariant}
                    colorfulExerciseCards={colorfulExerciseCards}
                    onToggleColorfulExerciseCards={setColorfulExerciseCards}
                    onBack={() => setTab('home')}
                    onViewAnalytics={() => {
                      setShowPatterns(false);
                      setShowMuscleMap(false);
                      setShowAnalytics(true);
                    }}
                    onViewPatterns={() => {
                      setShowAnalytics(false);
                      setShowMuscleMap(false);
                      setShowPatterns(true);
                    }}
                    onViewMuscleMap={() => {
                      setShowAnalytics(false);
                      setShowPatterns(false);
                      setShowMuscleMap(true);
                    }}
                    onExportData={handleExportData}
                    onImportData={handleImportData}
                    onResetApp={handleReset}
                    onResetOnboarding={handleResetOnboarding}
                  />
                </div>
              </div>
            </div>

            {!showAnalytics && !showPatterns && !showMuscleMap && <TabBar currentTab={tab} setTab={setTab} onWorkoutTripleTap={() => setShowSpartan(true)} />}

            {activeEquipment && (
                <EquipmentDetail
                  id={activeEquipment}
                  profile={profile}
                  history={Array.isArray(effectiveHistory[activeEquipment]) ? effectiveHistory[activeEquipment] : []}
                  onSave={handleSaveSession}
                  onUpdateSessionLogs={updateSessionLogs}
                  sessionLogs={activeSessionToday?.logsByExercise?.[activeEquipment] || []}
                onRequestUndo={showUndoToast}
                onShowToast={showToast}
                autoFocusInput={pendingAutoFocusExercise === activeEquipment}
                onAutoFocusComplete={() => setPendingAutoFocusExercise(null)}
                onClose={() => {
                  setActiveEquipment(null);
                  setPendingAutoFocusExercise(null);
                }}
              />
            )}

            {activeCardio && (
              <CardioLogger
                id={activeCardio}
                onUpdateSessionLogs={updateSessionLogs}
                sessionLogs={activeSessionToday?.logsByExercise?.[activeCardio] || []}
                history={Array.isArray(effectiveHistory[activeCardio]) ? effectiveHistory[activeCardio] : []}
                settings={settings}
                onClose={() => setActiveCardio(null)}
              />
            )}

            <MatrixWaterfall 
              show={showMatrix} 
              onClose={() => setShowMatrix(false)} 
            />

            <PowerUpEffect 
              show={showPowerUp} 
              onClose={() => setShowPowerUp(false)} 
            />

            <GloryEasterEgg 
              show={showGlory} 
              onClose={() => setShowGlory(false)} 
            />

            <SpartanKick 
              show={showSpartan} 
              onClose={() => setShowSpartan(false)} 
            />

            <ButDidYouDie 
              show={showButDidYouDie} 
              onClose={() => setShowButDidYouDie(false)}
              onConfirm={() => {
                setShowButDidYouDie(false);
                logRestDay();
              }}
            />

            <NiceToast show={showNice} />

            <PerfectWeek 
              show={showPerfectWeek} 
              onClose={() => setShowPerfectWeek(false)} 
            />
          </div>
        </>
      );
    };

    ReactDOM.render(
      React.createElement(App),
      document.getElementById('root'),
      () => {
        const loader = document.getElementById('ps-loading');
        if (loader) {
          loader.classList.add('hidden');
          setTimeout(() => loader.remove(), 450);
        }
      }
    );
