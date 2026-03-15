import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
    Droplet, Flame, ChevronDown, ChevronUp, Info, BarChart3, BookOpen, 
    Plus, Minus, Utensils, LayoutDashboard, Target, ArrowRight, Scale, 
    Dumbbell, Activity, Check, X, History, MessageSquare, Search, Hand, 
    Settings, Save, LogOut, Leaf, ChevronLeft, ChevronRight, Calendar,
    Moon, Sun, Download, Upload, Lightbulb, Edit3, TrendingUp, Heart, Coffee,
    Undo2, Copy, Zap, Clock, Sunrise, CloudSun, Sunset, MoonStar, Sparkles,
    AlertCircle, RefreshCw, Store
} from 'lucide-react';

const __ga = {
    started: false,
    loadedSent: false,
    endedSent: false
};

function trackEvent(name, params = {}) {
    try {
        if (typeof window.gtag === 'function') {
            window.gtag('event', name, params);
        }
    } catch (e) {
        // fail silently
    }
}

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .catch((err) => {
                // Non-fatal; app should still work fine
                console.error('Service worker registration failed:', err);
            });
    });
}

// Utils

function safeNum(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : undefined;
}

// --- HAPTIC FEEDBACK ---
const haptic = {
    light: () => navigator.vibrate?.(10),
    medium: () => navigator.vibrate?.(25),
    success: () => navigator.vibrate?.([10, 50, 20]),
    error: () => navigator.vibrate?.([50, 30, 50])
};

// --- LOCAL STORAGE ENGINE ---
const DB = {
    getProfile: () => JSON.parse(localStorage.getItem('steady_profile') || 'null'),
    saveProfile: (data) => localStorage.setItem('steady_profile', JSON.stringify(data)),
    getLog: (date) => JSON.parse(localStorage.getItem(`steady_logs_${date}`) || 'null'),
    saveLog: (date, data) => localStorage.setItem(`steady_logs_${date}`, JSON.stringify(data)),
    getWeightHistory: () => JSON.parse(localStorage.getItem('steady_weight_history') || '[]'),
    saveWeightLog: (log) => {
        const history = DB.getWeightHistory();
        const filtered = history.filter(h => h.date !== log.date);
        filtered.push(log);
        localStorage.setItem('steady_weight_history', JSON.stringify(filtered));
    },
    getRecentFoods: () => JSON.parse(localStorage.getItem('steady_recent_foods') || '[]'),
    addRecentFood: (food) => {
        let recent = DB.getRecentFoods();
        recent = recent.filter(f => f.name.toLowerCase() !== food.name.toLowerCase());
        recent.unshift({ ...food, lastUsed: Date.now() });
        localStorage.setItem('steady_recent_foods', JSON.stringify(recent.slice(0, 50)));
    },
    updateRecentFood: (oldName, patch) => {
        let recent = DB.getRecentFoods();
        const idx = recent.findIndex(f => f.name.toLowerCase() === oldName.toLowerCase());
        if (idx !== -1) { recent[idx] = { ...recent[idx], ...patch }; }
        localStorage.setItem('steady_recent_foods', JSON.stringify(recent));
    },
    deleteRecentFood: (name) => {
        const recent = DB.getRecentFoods().filter(f => f.name.toLowerCase() !== name.toLowerCase());
        localStorage.setItem('steady_recent_foods', JSON.stringify(recent));
    },
    getAllLogs: () => {
        const logs = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('steady_logs_')) {
                const date = key.replace('steady_logs_', '');
                logs[date] = JSON.parse(localStorage.getItem(key));
            }
        }
        return logs;
    },
    clearAll: () => {
        // Confirmation is handled by the in-app ConfirmResetModal in SettingsView
        localStorage.clear();
        window.location.reload();
    },
    exportData: () => {
        const data = {
            exportDate: new Date().toISOString(),
            version: '2.0',
            profile: DB.getProfile(),
            weightHistory: DB.getWeightHistory(),
            recentFoods: DB.getRecentFoods(),
            logs: DB.getAllLogs()
        };
        return data;
    },
    downloadExport: () => {
        const data = DB.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `steady-backup-${getTodayStr()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    importData: (jsonData) => {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (!data.profile) {
                throw new Error('Invalid backup file: missing profile data');
            }
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('steady_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            if (data.profile) localStorage.setItem('steady_profile', JSON.stringify(data.profile));
            if (data.weightHistory) localStorage.setItem('steady_weight_history', JSON.stringify(data.weightHistory));
            if (data.recentFoods) localStorage.setItem('steady_recent_foods', JSON.stringify(data.recentFoods));
            if (data.logs) {
                Object.entries(data.logs).forEach(([date, log]) => {
                    localStorage.setItem(`steady_logs_${date}`, JSON.stringify(log));
                });
            }
            return { success: true, message: 'Data imported successfully!' };
        } catch (error) {
            return { success: false, message: error.message || 'Failed to import data' };
        }
    }
};

// --- UTILS ---
const safeInt = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
};

const getTodayStr = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const getYesterdayStr = () => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const formatDateDisplay = (dateStr) => {
    const dateParts = dateStr.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); 
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const getMealPeriod = (timestamp) => {
    if (!timestamp) return 'snack';
    const hour = new Date(timestamp).getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 21) return 'dinner';
    return 'snack';
};

const getMealIcon = (period) => {
    switch(period) {
        case 'breakfast': return Sunrise;
        case 'lunch': return CloudSun;
        case 'dinner': return Sunset;
        default: return MoonStar;
    }
};

const getMealLabel = (period) => {
    switch(period) {
        case 'breakfast': return 'Morning';
        case 'lunch': return 'Midday';
        case 'dinner': return 'Evening';
        default: return 'Late Night';
    }
};

const daysSince = (dateStr) => {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

const isConsecutiveDay = (lastDateStr, todayStr) => {
    if (!lastDateStr) return false;
    const last = new Date(lastDateStr);
    const today = new Date(todayStr);
    const diffTime = today - last;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
};

const calculateBMR = (weightLbs, heightInches, age, sex) => {
    const w = safeInt(weightLbs);
    const h = safeInt(heightInches);
    const a = safeInt(age);
    if (w === 0 || h === 0 || a === 0) return 0;
    const weightKg = w * 0.453592;
    const heightCm = h * 2.54;
    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * a);
    if (sex === 'male') bmr += 5; else bmr -= 161;
    return Math.max(0, Math.round(bmr));
};

const recommendProtein = (weightLbs, heightInches, goalWeightLbs, strengthLevel) => {
    const w = safeInt(weightLbs);
    const h = safeInt(heightInches);
    if (w === 0 || h === 0) return { min: 0, max: 0, target: 0, method: 'Pending', factorRange: '0', bmi: '0' };
    const weightKg = w / 2.20462;
    const heightM = h * 0.0254;
    const bmi = heightM > 0 ? weightKg / (heightM * heightM) : 0;
    const gWeight = safeInt(goalWeightLbs);
    let goalDirection = 'maintain';
    if (gWeight > 0 && gWeight < w) goalDirection = 'loss';
    else if (gWeight > 0 && gWeight > w) goalDirection = 'gain';
    let minFactor = 0.8;
    let maxFactor = 1.0;
    switch (strengthLevel) {
        case 'not_yet': minFactor = 0.8; maxFactor = 1.0; break;
        case 'sometimes': minFactor = 1.2; maxFactor = 1.6; break;
        case 'regular': if (goalDirection === 'loss') { minFactor = 1.6; maxFactor = 2.0; } else { minFactor = 1.4; maxFactor = 1.8; } break;
        default: minFactor = 0.8; maxFactor = 1.0;
    }
    let calcWeightKg = weightKg;
    let method = "Total body weight";
    if (bmi >= 30) {
        calcWeightKg = 25 * (heightM * heightM);
        method = "Ref weight (BMI 25)";
    }
    const minG = Math.round(calcWeightKg * minFactor);
    const maxG = Math.round(calcWeightKg * maxFactor);
    const targetG = Math.round((minG + maxG) / 2);
    return { min: minG, max: maxG, target: targetG, method: method, factorRange: `${minFactor}-${maxFactor} g/kg`, bmi: bmi.toFixed(1) };
};

const suggestTargetWeight = (currentWeight, heightFt, heightIn) => {
    const w = safeInt(currentWeight);
    const h = (safeInt(heightFt) * 12) + safeInt(heightIn);
    if (w === 0 || h === 0) return null;
    
    const heightM = h * 0.0254;
    const currentWeightKg = w / 2.20462;
    const currentBMI = currentWeightKg / (heightM * heightM);
    
    const targetBMI = 22;
    const targetWeightKg = targetBMI * (heightM * heightM);
    const targetWeightLbs = Math.round(targetWeightKg * 2.20462);
    
    if (currentBMI > 25) {
        return { val: targetWeightLbs, reason: `Based on a healthy BMI of ${targetBMI}` };
    } else if (currentBMI < 18.5) {
        return { val: targetWeightLbs, reason: `To reach a healthy BMI of ${targetBMI}` };
    } else {
        return { val: w, reason: `Your current weight is in the healthy range` };
    }
};

// NEW: Suggest Healthy BMI Range (18.5 - 24.9)
const suggestHealthyRange = (heightFt, heightIn) => {
    const h = (safeInt(heightFt) * 12) + safeInt(heightIn);
    if (h === 0) return null;

    const heightM = h * 0.0254;
    // World Health Organization Healthy BMI Range: 18.5 - 24.9
    const minKg = 18.5 * (heightM * heightM);
    const maxKg = 24.9 * (heightM * heightM);
    
    return {
        min: Math.round(minKg * 2.20462),
        max: Math.round(maxKg * 2.20462)
    };
};

const calculateCalorieGoal = (bmr, activity, currentWeight, goalWeight) => {
    const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = Math.round(bmr * (activityMultipliers[activity] || 1.2));
    
    const gWeight = safeInt(goalWeight);
    const cWeight = safeInt(currentWeight);
    
    if (gWeight <= 0 || gWeight === cWeight) return tdee;
    
    if (gWeight < cWeight) {
        const percentDeficit = Math.round(tdee * 0.15);
        const maxDeficit = 750;
        const deficit = Math.min(percentDeficit, maxDeficit);
        return tdee - deficit;
    } else {
        const surplus = Math.min(Math.round(tdee * 0.10), 500);
        return tdee + surplus;
    }
};

const FOOD_LIBRARY = [
    { name: 'Chicken Breast (4oz)', protein: 35, calories: 185, portion: 'Palm size' },
    { name: 'Chicken Thigh (4oz)', protein: 28, calories: 240, portion: 'Palm size' },
    { name: 'Ground Beef 90% (4oz)', protein: 22, calories: 200, portion: 'Palm size' },
    { name: 'Steak (Sirloin, 4oz)', protein: 26, calories: 250, portion: 'Palm size' },
    { name: 'Salmon (4oz)', protein: 23, calories: 230, portion: 'Palm size' },
    { name: 'Tuna (1 can)', protein: 40, calories: 180, portion: 'Standard can' },
    { name: 'Egg (Large)', protein: 6, calories: 70, portion: '1 egg' },
    { name: 'Egg Whites (1 cup)', protein: 26, calories: 125, portion: 'Fist size' },
    { name: 'Greek Yogurt (1 cup)', protein: 20, calories: 130, portion: 'Fist size' },
    { name: 'Cottage Cheese (1 cup)', protein: 25, calories: 220, portion: 'Fist size' },
    { name: 'Protein Powder (1 scoop)', protein: 25, calories: 120, portion: '1 scoop' },
    { name: 'Rice (1 cup cooked)', protein: 4, calories: 200, portion: 'Fist size' },
    { name: 'Oats (1/2 cup dry)', protein: 5, calories: 150, portion: 'Cupped hand' },
    { name: 'Pasta (1 cup cooked)', protein: 7, calories: 220, portion: 'Fist size' },
    { name: 'Potato (Medium)', protein: 4, calories: 160, portion: 'Mouse size' },
    { name: 'Bread (1 slice)', protein: 3, calories: 80, portion: 'DVD case size' },
    { name: 'Apple (Medium)', protein: 0, calories: 95, portion: 'Baseball size' },
    { name: 'Banana (Medium)', protein: 1, calories: 105, portion: 'Hand length' },
    { name: 'Almonds (1/4 cup)', protein: 6, calories: 160, portion: 'Small handful' },
    { name: 'Peanut Butter (1 tbsp)', protein: 4, calories: 95, portion: 'Thumb size' },
    { name: 'Cheese (1 slice)', protein: 7, calories: 110, portion: '1 slice' },
    { name: 'Milk (1 cup)', protein: 8, calories: 150, portion: '1 glass' },
    { name: 'Tofu (4oz)', protein: 9, calories: 80, portion: 'Palm size' },
    { name: 'Black Beans (1/2 cup)', protein: 7, calories: 110, portion: 'Cupped hand' },
    { name: 'Shrimp (4oz)', protein: 24, calories: 120, portion: 'Palm size' },
];

// --- FAST FOOD DATABASE ---
const FAST_FOOD_DATA = {
    mcdonalds: {
        name: "McDonald's",
        color: "bg-red-500",
        items: [
            { name: "McDouble (no bun)", protein: 23, calories: 270, badge: "best", note: "Surprisingly solid macro ratio" },
            { name: "Egg McMuffin", protein: 17, calories: 310, badge: "solid", note: "Best breakfast option" },
            { name: "Grilled Chicken Sandwich", protein: 28, calories: 380, badge: "solid", note: "Ask for no mayo to save 100 cal" },
            { name: "6pc Chicken McNuggets", protein: 15, calories: 250, badge: "solid", note: "Decent protein snack" },
            { name: "Big Mac", protein: 25, calories: 590, badge: "aware", note: "Fine, just plan around it" },
            { name: "Large Fries", protein: 5, calories: 490, badge: "aware", note: "The real calorie bomb - split or skip" },
        ]
    },
    chickfila: {
        name: "Chick-fil-A",
        color: "bg-red-600",
        items: [
            { name: "Grilled Nuggets (12pc)", protein: 38, calories: 200, badge: "best", note: "Protein powerhouse, incredible ratio" },
            { name: "Grilled Chicken Sandwich", protein: 29, calories: 320, badge: "best", note: "One of the best fast food options anywhere" },
            { name: "Egg White Grill", protein: 25, calories: 290, badge: "best", note: "Best fast food breakfast, period" },
            { name: "Grilled Cool Wrap", protein: 37, calories: 350, badge: "solid", note: "High protein, keeps you full" },
            { name: "Original Chicken Sandwich", protein: 29, calories: 440, badge: "solid", note: "The classic - solid choice" },
            { name: "Waffle Fries (Medium)", protein: 4, calories: 420, badge: "aware", note: "Delicious but calorie-dense" },
        ]
    },
    chipotle: {
        name: "Chipotle",
        color: "bg-orange-700",
        items: [
            { name: "Chicken Bowl (no rice)", protein: 50, calories: 500, badge: "best", note: "Double chicken for +$3 = 80g protein" },
            { name: "Steak Bowl (no rice)", protein: 46, calories: 520, badge: "best", note: "Great macros, extra protein available" },
            { name: "Chicken Tacos (3)", protein: 35, calories: 510, badge: "solid", note: "Built-in portion control" },
            { name: "Salad (Chicken)", protein: 45, calories: 480, badge: "solid", note: "Get dressing on the side" },
            { name: "Chicken Burrito", protein: 50, calories: 1050, badge: "aware", note: "It's two meals - save half for later" },
            { name: "Chips & Guac", protein: 4, calories: 770, badge: "aware", note: "Share or skip - easy to overdo" },
        ]
    },
    wendys: {
        name: "Wendy's",
        color: "bg-red-500",
        items: [
            { name: "Grilled Chicken Sandwich", protein: 30, calories: 370, badge: "best", note: "Solid protein, reasonable calories" },
            { name: "Jr. Hamburger", protein: 15, calories: 250, badge: "solid", note: "Simple and light" },
            { name: "Chili (Large)", protein: 23, calories: 270, badge: "best", note: "Hidden gem - great macros" },
            { name: "Grilled Chicken Wrap", protein: 20, calories: 270, badge: "solid", note: "Light and satisfying" },
            { name: "Dave's Single", protein: 30, calories: 590, badge: "aware", note: "Plan around it - skip fries" },
            { name: "Baconator", protein: 57, calories: 950, badge: "aware", note: "High protein but very calorie-dense" },
        ]
    },
    tacobell: {
        name: "Taco Bell",
        color: "bg-purple-600",
        items: [
            { name: "Power Menu Bowl (Chicken)", protein: 26, calories: 470, badge: "best", note: "Best option at TB" },
            { name: "Chicken Soft Taco", protein: 12, calories: 170, badge: "solid", note: "Light and stackable - get 2-3" },
            { name: "Bean Burrito", protein: 13, calories: 380, badge: "solid", note: "Fiber-rich, keeps you full" },
            { name: "Crunchy Taco", protein: 8, calories: 170, badge: "solid", note: "Classic, light option" },
            { name: "Crunchwrap Supreme", protein: 16, calories: 540, badge: "aware", note: "Filling but calorie-dense" },
            { name: "Nachos BellGrande", protein: 12, calories: 740, badge: "aware", note: "Share it or skip it" },
        ]
    },
    subway: {
        name: "Subway",
        color: "bg-green-600",
        items: [
            { name: "Turkey Breast 6\" (no cheese)", protein: 18, calories: 280, badge: "best", note: "Classic lean choice" },
            { name: "Chicken Breast 6\"", protein: 23, calories: 320, badge: "best", note: "Most protein per calorie" },
            { name: "Veggie Delite 6\"", protein: 8, calories: 200, badge: "solid", note: "Lightest option available" },
            { name: "Steak & Cheese 6\"", protein: 26, calories: 380, badge: "solid", note: "Good protein, moderate calories" },
            { name: "Meatball Marinara 6\"", protein: 22, calories: 480, badge: "aware", note: "Tasty but higher calorie" },
            { name: "Footlong BMT", protein: 34, calories: 860, badge: "aware", note: "Save half for later" },
        ]
    },
    burgerking: {
        name: "Burger King",
        color: "bg-orange-600",
        items: [
            { name: "Grilled Chicken Sandwich", protein: 28, calories: 430, badge: "best", note: "Best BK option" },
            { name: "Hamburger", protein: 13, calories: 240, badge: "solid", note: "Simple and light" },
            { name: "Whopper Jr.", protein: 13, calories: 310, badge: "solid", note: "Smaller portion, reasonable" },
            { name: "4pc Chicken Nuggets", protein: 8, calories: 170, badge: "solid", note: "Light snack option" },
            { name: "Whopper", protein: 28, calories: 660, badge: "aware", note: "Plan around it - no fries" },
            { name: "Double Whopper", protein: 48, calories: 900, badge: "aware", note: "High protein but very calorie-dense" },
        ]
    },
    pandaexpress: {
        name: "Panda Express",
        color: "bg-red-700",
        items: [
            { name: "Grilled Teriyaki Chicken", protein: 36, calories: 300, badge: "best", note: "Best protein option by far" },
            { name: "String Bean Chicken", protein: 14, calories: 190, badge: "best", note: "Light and lean" },
            { name: "Broccoli Beef", protein: 13, calories: 150, badge: "solid", note: "Low calorie, decent protein" },
            { name: "Mushroom Chicken", protein: 13, calories: 170, badge: "solid", note: "Solid lighter choice" },
            { name: "Orange Chicken", protein: 13, calories: 490, badge: "aware", note: "The fried coating adds up" },
            { name: "Fried Rice", protein: 9, calories: 530, badge: "aware", note: "Get steamed rice instead (-250 cal)" },
        ]
    },
    starbucks: {
        name: "Starbucks",
        color: "bg-green-700",
        items: [
            { name: "Egg White & Roasted Red Pepper Bites", protein: 13, calories: 170, badge: "best", note: "Great protein snack" },
            { name: "Turkey Bacon & Egg White Sandwich", protein: 17, calories: 230, badge: "best", note: "Best breakfast sandwich" },
            { name: "Protein Box (Cheese & Fruit)", protein: 13, calories: 470, badge: "solid", note: "Balanced snack box" },
            { name: "Spinach & Feta Wrap", protein: 20, calories: 290, badge: "solid", note: "Filling and reasonable" },
            { name: "Bacon & Gouda Sandwich", protein: 18, calories: 360, badge: "solid", note: "Tasty, moderate calories" },
            { name: "Vanilla Latte (Grande)", protein: 8, calories: 250, badge: "aware", note: "Get sugar-free syrup to save 80 cal" },
        ]
    },
    fiveguys: {
        name: "Five Guys",
        color: "bg-red-800",
        items: [
            { name: "Little Hamburger", protein: 27, calories: 480, badge: "best", note: "Best option here - still a real burger" },
            { name: "Little Bacon Burger", protein: 33, calories: 560, badge: "solid", note: "Smaller portion, good protein" },
            { name: "Hamburger (Lettuce Wrap)", protein: 40, calories: 440, badge: "best", note: "Skip the bun, keep the flavor" },
            { name: "Hot Dog", protein: 18, calories: 545, badge: "solid", note: "Surprisingly reasonable" },
            { name: "Bacon Cheeseburger", protein: 51, calories: 920, badge: "aware", note: "High protein but calorie bomb" },
            { name: "Regular Fries", protein: 10, calories: 953, badge: "aware", note: "Split with 2-3 people or skip" },
        ]
    }
};

const computeTotals = (items) => {
    const list = items || [];
    return {
        protein: list.reduce((sum, item) => sum + safeInt(item.protein), 0),
        calories: list.reduce((sum, item) => sum + safeInt(item.calories), 0)
    };
};

const Toast = ({ message, action, onAction, onClose, type = 'info' }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'bg-violet-800' : type === 'error' ? 'bg-red-800' : 'bg-stone-800';

    return (
        <div className={`fixed bottom-24 left-4 right-4 ${bgColor} text-white p-4 rounded-2xl shadow-2xl z-[100] animate-slide-in-up flex items-center justify-between gap-3`}>
            <span className="text-sm font-medium">{message}</span>
            {action && (
                <button onClick={onAction} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-transform">
                    <Undo2 size={14} /> {action}
                </button>
            )}
        </div>
    );
};

// --- COMPONENTS ---

const WeightUpdateModal = ({ isOpen, onClose, currentWeight, onUpdate }) => {
    const [weight, setWeight] = useState(currentWeight || '');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-stone-100 dark:border-stone-800 text-center animate-zoom-in">
                <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-600 dark:text-stone-300">
                    <Scale size={24} />
                </div>
                <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-2">Check-in Time</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Updating your weight keeps your calorie targets accurate.</p>
                <div className="mb-6 relative">
                    <input 
                        type="number" 
                        inputMode="numeric" 
                        pattern="[0-9]*" 
                        value={weight} 
                        onChange={(e) => setWeight(e.target.value)} 
                        className="w-full p-4 text-center text-2xl font-bold bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" 
                        autoFocus 
                    />
                    <span className="absolute right-8 top-5 text-stone-400 text-sm font-medium">lbs</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 font-medium active:scale-95 transition-transform">Skip</button>
                    <button onClick={() => { haptic.success(); onUpdate(weight); onClose(); }} className="flex-1 py-3 bg-stone-800 dark:bg-stone-700 text-stone-50 font-bold rounded-xl hover:bg-stone-700 transition-colors active:scale-95">Update</button>
                </div>
            </div>
        </div>
    );
};

const WeightGraph = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800 border-dashed mt-6">
                <Scale size={24} className="text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs text-stone-400">Log your first weigh-in to start tracking</p>
            </div>
        );
    }
    
    if (data.length === 1) {
        return (
            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm mt-6">
                <div className="flex justify-between items-end mb-4">
                    <h4 className="font-bold text-stone-700 dark:text-stone-200">Weight Trend</h4>
                    <span className="text-xs text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 px-2 py-1 rounded-lg">First entry!</span>
                </div>
                <div className="flex items-center justify-center h-24 bg-stone-50 dark:bg-stone-800 rounded-2xl">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-stone-800 dark:text-stone-100">{data[0].weight} lbs</div>
                        <div className="text-xs text-stone-400 mt-1">Starting weight • {new Date(data[0].date).toLocaleDateString()}</div>
                    </div>
                </div>
                <p className="text-xs text-stone-400 text-center mt-3">Check back after your next weigh-in to see your trend</p>
            </div>
        );
    }
    
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const weights = sorted.map(d => d.weight);
    const minW = Math.min(...weights) - 5;
    const maxW = Math.max(...weights) + 5;
    const points = sorted.map((d, i) => {
        const x = (i / (sorted.length - 1)) * 100;
        const y = 40 - ((d.weight - minW) / (maxW - minW)) * 40;
        return `${x},${y}`;
    }).join(' ');
    
    const firstWeight = sorted[0].weight;
    const lastWeight = sorted[sorted.length - 1].weight;
    const change = lastWeight - firstWeight;

    return (
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm mt-6">
            <div className="flex justify-between items-end mb-4">
                <h4 className="font-bold text-stone-700 dark:text-stone-200">Weight Trend</h4>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${change < 0 ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' : change > 0 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)} lbs
                    </span>
                </div>
            </div>
            <div className="relative h-32 w-full">
                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" className="text-stone-100 dark:text-stone-800" strokeWidth="0.5" />
                    <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" className="text-stone-100 dark:text-stone-800" strokeWidth="0.5" />
                    <line x1="0" y1="40" x2="100" y2="40" stroke="currentColor" className="text-stone-100 dark:text-stone-800" strokeWidth="0.5" />
                    <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-stone-800 dark:text-stone-200" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    {sorted.map((d, i) => {
                        const x = (i / (sorted.length - 1)) * 100;
                        const y = 40 - ((d.weight - minW) / (maxW - minW)) * 40;
                        return <circle cx={x} cy={y} r="1.5" className="fill-stone-800 dark:fill-stone-200 stroke-white dark:stroke-stone-900" strokeWidth="0.5" key={i} />;
                    })}
                </svg>
            </div>
        </div>
    );
};

const SupportView = ({ onBack }) => {
    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 -ml-2 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors active:scale-95">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100">Support Steady</h2>
            </div>
            <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 text-center">
                <div className="w-20 h-20 bg-violet-50 dark:bg-violet-900/30 text-teal-700 dark:text-teal-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Heart size={40} fill="currentColor" />
                </div>
                <h3 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-4">Independent & Free</h3>
                <div className="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed mb-8">
                    <p>Steady was built on a simple belief: <strong>Nutrition shouldn't be stressful.</strong></p>
                    <p>We don't sell your data. We don't flood you with ads.</p>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-2xl mb-8">
                    <p className="text-stone-800 dark:text-stone-200 font-medium mb-2">If Steady has helped you...</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Consider buying us a coffee. It helps cover database costs and keeps the app free for everyone.</p>
                </div>
                <button onClick={() => window.open('https://buymeacoffee.com/', '_blank')} className="w-full py-4 bg-[#FFDD00] text-stone-900 font-bold rounded-2xl shadow-lg shadow-yellow-100 dark:shadow-none hover:bg-[#FACC15] transition-transform active:scale-95 flex items-center justify-center gap-2">
                    <Coffee size={20} /> Buy us a Coffee
                </button>
            </div>
        </div>
    );
};

const InsightCard = ({ proteinRemaining, caloriesOver, caloriesRemaining, proteinTarget }) => {
    const hoursLeft = 24 - new Date().getHours();
    
    let insight = null;

    // Priority 1 — meaningfully over on calories (teaching moment)
    if (caloriesOver >= 200) {
        const isAlsoProteinDone = proteinRemaining <= 0;
        insight = {
            type: 'over',
            icon: TrendingUp,
            title: `${caloriesOver} cal over today`,
            message: isAlsoProteinDone
                ? `Protein goal done though — that's the important win. One day over won't derail you.`
                : `Worth knowing for next time. Protein is still ${proteinRemaining}g short — prioritise that tomorrow.`,
        };
    // Priority 2 — slightly over (gentle nudge, not alarm)
    } else if (caloriesOver > 0 && caloriesOver < 200) {
        insight = {
            type: 'nudge',
            icon: AlertCircle,
            title: `${caloriesOver} cal over`,
            message: `Just a small overage — totally manageable. Stay consistent and it evens out.`,
        };
    // Priority 3 — protein done, calories budget left
    } else if (proteinRemaining <= 0 && caloriesRemaining > 200) {
        insight = {
            type: 'success',
            icon: Sparkles,
            title: 'Protein goal hit! 🎉',
            message: `You still have ${caloriesRemaining} cal left if you want a snack or treat.`,
        };
    // Priority 4 — almost at protein goal
    } else if (proteinRemaining > 0 && proteinRemaining <= 20) {
        insight = {
            type: 'close',
            icon: Target,
            title: 'Almost there!',
            message: `Just ${proteinRemaining}g more protein. A Greek yogurt or a couple of eggs would do it.`,
        };
    // Priority 5 — running out of day with a big protein gap
    } else if (proteinRemaining > 30 && hoursLeft < 6) {
        const suggestions = FOOD_LIBRARY
            .filter(f => f.protein >= 20)
            .sort((a, b) => (b.protein / b.calories) - (a.protein / a.calories))
            .slice(0, 2);
        insight = {
            type: 'warning',
            icon: AlertCircle,
            title: `${proteinRemaining}g protein to go`,
            message: `${hoursLeft} hours left today. Quick wins:`,
            suggestions: suggestions.map(s => `${s.name} (${s.protein}g)`),
        };
    }

    if (!insight) return null;

    const colors = {
        over:    'bg-red-50    dark:bg-red-900/20    border-red-100    dark:border-red-800',
        nudge:   'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800',
        warning: 'bg-amber-50  dark:bg-amber-900/20  border-amber-100  dark:border-amber-800',
        success: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800',
        close:   'bg-blue-50   dark:bg-blue-900/20   border-blue-100   dark:border-blue-800',
    };
    const iconColors = {
        over:    'text-red-500    dark:text-red-400',
        nudge:   'text-orange-500 dark:text-orange-400',
        warning: 'text-amber-600  dark:text-amber-400',
        success: 'text-violet-600 dark:text-violet-300',
        close:   'text-blue-600   dark:text-blue-400',
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[insight.type]} animate-slide-up`}>
            <div className="flex gap-3">
                <insight.icon size={20} className={`${iconColors[insight.type]} shrink-0 mt-0.5`} />
                <div className="flex-1">
                    <h4 className="font-bold text-stone-800 dark:text-stone-100 text-sm">{insight.title}</h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{insight.message}</p>
                    {insight.suggestions && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {insight.suggestions.map((s, i) => (
                                <span key={i} className="text-xs bg-white dark:bg-stone-800 px-2 py-1 rounded-lg text-stone-600 dark:text-stone-300">{s}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const QuickLogSection = ({ yesterdayItems, onCopyYesterday }) => {
    if (!yesterdayItems || yesterdayItems.length === 0) return null;
    return (
        <button
            onClick={onCopyYesterday}
            className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-transform"
        >
            <div className="flex items-center gap-2">
                <Copy size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Copy yesterday's log</span>
            </div>
            <span className="text-xs text-indigo-500 dark:text-indigo-400">{yesterdayItems.length} items</span>
        </button>
    );
};


// ── MY FOODS — edit / delete custom saved foods ─────────────────────────────
const MyFoodsView = ({ onBack, onFoodsChanged }) => {
    const [foods, setFoods] = useState(DB.getRecentFoods());
    const [editing, setEditing] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const refresh = () => {
        const updated = DB.getRecentFoods();
        setFoods(updated);
        onFoodsChanged(updated);
    };

    const handleSaveEdit = () => {
        if (!editing.name.trim()) return;
        haptic.success();
        DB.updateRecentFood(editing.originalName, {
            name:     editing.name.trim(),
            protein:  safeInt(editing.protein),
            calories: safeInt(editing.calories),
        });
        setEditing(null);
        refresh();
    };

    const handleDelete = (name) => {
        haptic.error();
        DB.deleteRecentFood(name);
        setConfirmDelete(null);
        refresh();
    };

    const inp = "w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none text-sm";

    return (
        <div className="p-4 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 -ml-2 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors active:scale-95">
                    <ChevronLeft size={22} />
                </button>
                <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">My Foods</h2>
            </div>

            {foods.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <BookOpen size={20} className="text-stone-400" />
                    </div>
                    <p className="text-sm font-bold text-stone-600 dark:text-stone-300 mb-1">No saved foods yet</p>
                    <p className="text-xs text-stone-400">Foods you log appear here. You can edit or remove them.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {foods.map((food, idx) => (
                        <div key={idx} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
                            {editing?.originalName === food.name ? (
                                <div className="p-4 space-y-3">
                                    <input
                                        className={inp}
                                        value={editing.name}
                                        placeholder="Food name"
                                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-stone-400 uppercase tracking-wider font-bold ml-1">Protein (g)</label>
                                            <input type="number" inputMode="numeric" className={inp}
                                                value={editing.protein}
                                                onChange={e => setEditing({ ...editing, protein: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-stone-400 uppercase tracking-wider font-bold ml-1">Calories</label>
                                            <input type="number" inputMode="numeric" className={inp}
                                                value={editing.calories}
                                                onChange={e => setEditing({ ...editing, calories: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => setEditing(null)}
                                            className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-500 font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                            Cancel
                                        </button>
                                        <button onClick={handleSaveEdit}
                                            className="flex-1 py-2.5 bg-stone-800 dark:bg-stone-700 text-white font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : confirmDelete === food.name ? (
                                <div className="p-4">
                                    <p className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-1">Remove &ldquo;{food.name}&rdquo;?</p>
                                    <p className="text-xs text-stone-400 mb-3">Won't be suggested when logging. Past logs are unaffected.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setConfirmDelete(null)}
                                            className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-500 font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                            Keep
                                        </button>
                                        <button onClick={() => handleDelete(food.name)}
                                            className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-stone-800 dark:text-stone-100 text-sm truncate">{food.name}</div>
                                        <div className="flex gap-2 mt-1">
                                            {food.protein > 0 && <span className="text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md font-medium">{food.protein}g Pro</span>}
                                            {food.calories > 0 && <span className="text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-md font-medium">{food.calories} Cal</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-3 shrink-0">
                                        <button
                                            onClick={() => setEditing({ originalName: food.name, name: food.name, protein: food.protein, calories: food.calories })}
                                            className="p-2 text-stone-300 hover:text-violet-500 dark:hover:text-violet-400 rounded-lg transition-colors active:scale-90">
                                            <Edit3 size={15} />
                                        </button>
                                        <button onClick={() => setConfirmDelete(food.name)}
                                            className="p-2 text-stone-300 hover:text-red-500 rounded-lg transition-colors active:scale-90">
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ConfirmResetModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-stone-100 dark:border-stone-800 animate-zoom-in">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogOut size={22} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 text-center mb-2">Reset all data?</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 text-center mb-6 leading-relaxed">
                    This permanently deletes your profile, food logs, and weight history from this device. There's no undo.
                </p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors active:scale-95">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors active:scale-95">
                        Yes, Reset
                    </button>
                </div>
            </div>
        </div>
    );
};

const SettingsView = ({ profile, onUpdate, onLogout, toggleTheme, isDark, onNavigate, onImport, selectedDate, recentFoods, onFoodsChanged }) => {
    const [formData, setFormData] = useState({ 
        currentWeight: profile.currentWeight || '', 
        goalWeight: profile.goalWeight || '', 
        activity: profile.activity || 'sedentary', 
        strengthTrainingLevel: profile.strengthTrainingLevel || 'not_yet' 
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [importStatus, setImportStatus] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showMyFoods, setShowMyFoods] = useState(false);
    const fileInputRef = useRef(null);

    if (showMyFoods) return (
        <MyFoodsView
            onBack={() => setShowMyFoods(false)}
            onFoodsChanged={onFoodsChanged}
        />
    );

    const handleSave = async () => {
        setIsSaving(true);
        haptic.medium();
        const curWeight = safeInt(formData.currentWeight);
        const heightTotalInches = (safeInt(profile.heightFt) * 12) + safeInt(profile.heightIn);
        const bmr = calculateBMR(curWeight, heightTotalInches, profile.age, profile.sex);
        const tdee = calculateCalorieGoal(bmr, formData.activity, curWeight, formData.goalWeight);
        const proteinRec = recommendProtein(curWeight, heightTotalInches, formData.goalWeight, formData.strengthTrainingLevel);
        const water = Math.round(curWeight / 2);
        await onUpdate({ ...profile, ...formData, targets: { calories: tdee, protein: proteinRec.target, water: water } });
        setIsSaving(false);
        haptic.success();
    };

    const handleExport = () => {
        haptic.light();
        DB.downloadExport();
        trackEvent('export_csv', { date: selectedDate });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = DB.importData(event.target.result);
            setImportStatus(result);
            if (result.success) {
                haptic.success();
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                haptic.error();
                setTimeout(() => setImportStatus(null), 3000);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="p-4 space-y-6 animate-fade-in">
            {importStatus && (
                <div className={`p-4 rounded-2xl text-center font-medium ${importStatus.success ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                    {importStatus.message}
                    {importStatus.success && <span className="block text-xs mt-1">Reloading...</span>}
                </div>
            )}
            
            <button onClick={() => onNavigate('support')} className="w-full bg-violet-50 dark:bg-violet-900/20 p-4 rounded-3xl border border-violet-100 dark:border-violet-800 flex items-center justify-between group active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-stone-800 rounded-full text-violet-600 dark:text-violet-300 shadow-sm">
                        <Heart size={20} fill="currentColor" className="opacity-80" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">Support Steady</h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Help keep us free & independent</p>
                    </div>
                </div>
                <ChevronRight size={20} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
            </button>
            
            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-600 dark:text-stone-400">
                        {isDark ? <Moon size={20}/> : <Sun size={20}/>}
                    </div>
                    <span className="font-bold text-stone-800 dark:text-stone-200">Dark Mode</span>
                </div>
                <button onClick={() => { haptic.light(); toggleTheme(); }} className={`w-12 h-6 rounded-full p-1 transition-colors ${isDark ? 'bg-violet-500' : 'bg-stone-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : ''}`} />
                </button>
            </div>

            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800">
                <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Your Data</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Export your data for backup or import from a previous backup.</p>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <Download size={18} /> Export
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <Upload size={18} /> Import
                    </button>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".json,application/json" 
                        onChange={handleFileSelect}
                        className="hidden" 
                    />
                </div>
            </div>

            {/* My Foods */}
            <button onClick={() => { haptic.light(); setShowMyFoods(true); }} className="w-full bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-600 dark:text-stone-400">
                        <Edit3 size={18} />
                    </div>
                    <div className="text-left">
                        <div className="font-bold text-stone-800 dark:text-stone-100 text-sm">My Foods</div>
                        <div className="text-xs text-stone-400">Edit or remove your saved foods</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {recentFoods?.length > 0 && (
                        <span className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-0.5 rounded-full">{recentFoods.length}</span>
                    )}
                    <ChevronRight size={18} className="text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors" />
                </div>
            </button>
            
            <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden">
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-full p-6 flex justify-between items-center text-left">
                    <div>
                        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Personal Details</h2>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Recalibrate your targets</p>
                    </div>
                    {isProfileOpen ? <ChevronUp size={20} className="text-stone-400"/> : <ChevronDown size={20} className="text-stone-400"/>}
                </button>
                {isProfileOpen && (
                    <div className="p-6 pt-0 space-y-4 border-t border-stone-50 dark:border-stone-800 mt-2 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Current Weight</label>
                            <input type="number" inputMode="numeric" value={formData.currentWeight} onChange={e => setFormData({...formData, currentWeight: e.target.value})} className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Goal Weight</label>
                            <input type="number" inputMode="numeric" value={formData.goalWeight} onChange={e => setFormData({...formData, goalWeight: e.target.value})} className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" />
                        </div>
                        <button onClick={handleSave} disabled={isSaving} className="w-full mt-4 bg-stone-800 dark:bg-stone-700 text-stone-50 py-4 rounded-2xl font-bold hover:bg-stone-700 transition-colors active:scale-95 disabled:opacity-50">
                            {isSaving ? 'Recalculating...' : 'Update & Recalculate'}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="text-center">
                <button onClick={() => { haptic.light(); setShowResetConfirm(true); }} className="text-stone-400 dark:text-stone-600 text-sm hover:text-red-500 flex items-center justify-center gap-2 mx-auto transition-colors">
                    <LogOut size={14} /> Reset App Data
                </button>
            </div>

            <ConfirmResetModal
                isOpen={showResetConfirm}
                onCancel={() => setShowResetConfirm(false)}
                onConfirm={() => { haptic.error(); onLogout(); }}
            />
        </div>
    );
};


// ── ONBOARDING ──────────────────────────────────────────────────────────────
// One focused question per step — reduces mobile drop-off.
// Steps: 0=Welcome  1=Weight  2=Height  3=Age+Sex  4=Goal  5=Activity  6=Training  7=Blueprint

// ── ONBOARDING — single container, slides between steps, custom numpad ───────
// No system keyboard on numeric steps = zero layout jump.
// All steps live in one mounted div; content slides with CSS transform.

const ONBOARD_TOTAL = 7; // steps 1-7 (0 = welcome splash)

// Custom numeric keypad — shown instead of system keyboard on number steps
const NumPad = ({ value, onChange, onNext, nextDisabled, hint }) => {
    const tap = (k) => {
        haptic.light();
        if (k === '⌫') {
            onChange(value.slice(0, -1));
        } else if (k === '→') {
            if (!nextDisabled) onNext();
        } else {
            // Max 4 digits (999.9 lbs / inches / years is plenty)
            if (value.length < 4) onChange(value + k);
        }
    };

    const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','→'];
    const displayVal = value || '';

    return (
        <div className="flex flex-col items-center w-full">
            {/* Big display */}
            <div className="w-full bg-stone-50 dark:bg-stone-800 rounded-2xl px-6 py-5 flex items-center justify-between mb-2">
                <span className={`text-5xl font-extrabold tracking-tight transition-all ${displayVal ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-600'}`}>
                    {displayVal || '—'}
                </span>
                {hint && <span className="text-sm text-stone-400 font-medium">{hint}</span>}
            </div>
            {/* Keypad grid */}
            <div className="grid grid-cols-3 gap-2 w-full mt-1">
                {keys.map(k => {
                    const isNext    = k === '→';
                    const isBack    = k === '⌫';
                    const nextReady = isNext && !nextDisabled;
                    return (
                        <button
                            key={k}
                            onClick={() => tap(k)}
                            disabled={isNext && nextDisabled}
                            className={`py-4 rounded-2xl text-xl font-bold transition-all active:scale-[0.93] select-none
                                ${isNext && nextDisabled ? 'bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed' :
                                  nextReady              ? 'bg-stone-800 dark:bg-stone-700 text-white shadow-lg active:bg-stone-700' :
                                  isBack                 ? 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300' :
                                                           'bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 text-stone-800 dark:text-stone-100 shadow-sm'
                                }`}
                        >
                            {isNext ? (nextDisabled ? '→' : '→') : k}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const Onboarding = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [dir,  setDir]  = useState(1);   // 1 = forward, -1 = backward
    const [animKey, setAnimKey] = useState(0); // triggers re-animation
    const [form, setForm] = useState({
        currentWeight: '', goalWeight: '', age: '',
        heightFt: '', heightIn: '', sex: 'female',
        activity: 'sedentary', strengthTrainingLevel: 'not_yet',
        manualCalories: '', manualProtein: '', manualWater: '',
    });
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const go = (delta) => {
        haptic[delta > 0 ? 'medium' : 'light']();
        setDir(delta);
        setAnimKey(k => k + 1);
        setStep(s => s + delta);
    };
    const next = () => go(1);
    const back = () => go(-1);
    const set  = (patch) => setForm(f => ({ ...f, ...patch }));

    const calc = useMemo(() => {
        const w  = safeInt(form.currentWeight);
        const hi = (safeInt(form.heightFt) * 12) + safeInt(form.heightIn);
        const a  = safeInt(form.age);
        if (!w || !hi || !a) return { calories: 0, proteinTarget: 0, proteinMin: 0, proteinMax: 0, water: 0 };
        const bmr  = calculateBMR(w, hi, a, form.sex);
        const cal  = calculateCalorieGoal(bmr, form.activity, w, form.goalWeight);
        const prec = recommendProtein(w, hi, form.goalWeight, form.strengthTrainingLevel);
        return { calories: cal, proteinTarget: prec.target, proteinMin: prec.min, proteinMax: prec.max, water: Math.round(w / 2) };
    }, [form]);

    const healthyRange = useMemo(() => suggestHealthyRange(form.heightFt, form.heightIn), [form.heightFt, form.heightIn]);
    const suggestion   = useMemo(() => suggestTargetWeight(safeInt(form.currentWeight), form.heightFt, form.heightIn), [form.currentWeight, form.heightFt, form.heightIn]);

    // Slide animation class based on direction
    const slideClass = dir > 0 ? 'animate-slide-from-right' : 'animate-slide-from-left';

    // Progress dots (steps 1-7)
    const ProgressDots = () => step === 0 ? null : (
        <div className="flex gap-1.5 px-6 pt-5 pb-2 flex-shrink-0">
            {Array.from({ length: ONBOARD_TOTAL }).map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-400 ${
                    i < step - 1  ? 'bg-violet-500' :
                    i === step - 1 ? 'bg-violet-400' :
                    'bg-stone-200 dark:bg-stone-700'
                }`} />
            ))}
        </div>
    );

    // Shared footer with Back + Next buttons
    const Footer = ({ onNext, nextDisabled, nextLabel = 'Continue', last, skipLabel, onSkip }) => (
        <div className="px-6 pb-8 pt-3 flex-shrink-0 space-y-2">
            <div className="flex gap-3">
                {step > 0 && (
                    <button onClick={back}
                        className="w-12 h-14 flex items-center justify-center bg-stone-100 dark:bg-stone-800 rounded-2xl text-stone-500 active:scale-95 transition-transform flex-shrink-0">
                        <ChevronLeft size={22} />
                    </button>
                )}
                <button onClick={onNext} disabled={nextDisabled}
                    className={`flex-1 h-14 font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${
                        last
                        ? 'bg-violet-600 text-white shadow-violet-200 dark:shadow-none'
                        : 'bg-stone-800 dark:bg-stone-700 text-white shadow-stone-200 dark:shadow-none'
                    }`}>
                    {nextLabel} {!last && <ArrowRight size={18} />}
                </button>
            </div>
            {skipLabel && (
                <button onClick={onSkip} className="w-full text-center text-stone-400 text-sm py-1 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
                    {skipLabel}
                </button>
            )}
        </div>
    );

    // ── Step 0: Welcome splash ───────────────────────────────────────────────
    if (step === 0) return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-stone-900 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-teal-500 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-violet-200 dark:shadow-none">
                <Leaf size={36} className="text-white" />
            </div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Welcome to</span>
            <h1 className="text-4xl font-extrabold text-stone-800 dark:text-stone-100 mt-1 mb-8">Steady</h1>
            <div className="w-full text-left space-y-4 text-sm mb-10 bg-stone-50 dark:bg-stone-800 p-6 rounded-2xl border border-stone-100 dark:border-stone-700">
                {[
                    { n:1, color:'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',    bold:'Evidence-based.',     desc:'Scientific formulas, real safety guardrails.' },
                    { n:2, color:'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400', bold:'No database needed.', desc:'Log what you know. Learn what you eat.' },
                    { n:3, color:'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300',    bold:"You're in control.",  desc:'Starting points, not a contract.' },
                ].map(({ n, color, bold, desc }) => (
                    <div key={n} className="flex gap-3">
                        <div className={`mt-0.5 ${color} w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>{n}</div>
                        <p className="text-stone-600 dark:text-stone-400"><strong className="text-stone-800 dark:text-stone-200">{bold}</strong> {desc}</p>
                    </div>
                ))}
            </div>
            <button onClick={next} className="w-full py-4 bg-stone-800 dark:bg-stone-700 text-stone-50 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                Build My Plan <ArrowRight size={18} />
            </button>
        </div>
    );

    // Steps 1-7 share one mounted container — no remounting, no keyboard jump
    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-stone-900 overflow-hidden">
            <ProgressDots />

            {/* Sliding content area */}
            <div key={animKey} className={`flex-1 overflow-y-auto overflow-x-hidden ${slideClass}`}>

                {/* ── Step 1: Current weight ── */}
                {step === 1 && (
                    <div className="px-6 pt-4 pb-2 space-y-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">What do you weigh?</h2>
                            <p className="text-sm text-stone-400">Just your starting point — no judgment here.</p>
                        </div>
                        <NumPad
                            value={form.currentWeight}
                            onChange={v => set({ currentWeight: v })}
                            onNext={next}
                            nextDisabled={safeInt(form.currentWeight) <= 0}
                            hint="lbs"
                        />
                    </div>
                )}

                {/* ── Step 2: Height ── */}
                {step === 2 && (
                    <div className="px-6 pt-4 pb-2 space-y-5">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">How tall are you?</h2>
                            <p className="text-sm text-stone-400">Used to calculate your targets accurately.</p>
                        </div>
                        {/* Two-field height — ft then in, each with its own mini numpad */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">Feet</label>
                                <NumPad
                                    value={form.heightFt}
                                    onChange={v => set({ heightFt: v })}
                                    onNext={() => {}} // inches field handles next
                                    nextDisabled={true}
                                    hint="ft"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">Inches</label>
                                <NumPad
                                    value={form.heightIn}
                                    onChange={v => { if (safeInt(v) <= 11) set({ heightIn: v }); }}
                                    onNext={next}
                                    nextDisabled={safeInt(form.heightFt) <= 0}
                                    hint="in"
                                />
                            </div>
                            {healthyRange && (
                                <div className="p-3 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex gap-2 items-start">
                                    <Info size={14} className="text-violet-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-violet-700 dark:text-violet-300">
                                        Healthy range for your height: <strong>{healthyRange.min}–{healthyRange.max} lbs</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 3: Age & Sex ── */}
                {step === 3 && (
                    <div className="px-6 pt-4 pb-2 space-y-5">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">Age & biological sex</h2>
                            <p className="text-sm text-stone-400">Needed for the BMR formula — used only for math.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">Age</label>
                            <NumPad
                                value={form.age}
                                onChange={v => set({ age: v })}
                                onNext={next}
                                nextDisabled={safeInt(form.age) <= 0}
                                hint="years"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">Biological Sex</label>
                            <div className="flex gap-3">
                                {['female','male'].map(s => (
                                    <button key={s} onClick={() => { haptic.light(); set({ sex: s }); }}
                                        className={`flex-1 py-4 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95 ${
                                            form.sex === s
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                            : 'border-stone-100 dark:border-stone-700 text-stone-500 bg-stone-50 dark:bg-stone-800'
                                        }`}>
                                        {s === 'female' ? 'Female' : 'Male'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Step 4: Goal weight ── */}
                {step === 4 && (
                    <div className="px-6 pt-4 pb-2 space-y-5">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">Where are you headed?</h2>
                            <p className="text-sm text-stone-400">Your target weight shapes your calorie math.</p>
                        </div>
                        <NumPad
                            value={form.goalWeight}
                            onChange={v => set({ goalWeight: v })}
                            onNext={next}
                            nextDisabled={false}
                            hint="lbs"
                        />
                        {suggestion && !form.goalWeight && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex gap-2 items-center">
                                <Lightbulb size={14} className="text-indigo-500 shrink-0" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 flex-1">
                                    Suggestion: <strong>{suggestion.val} lbs</strong> — {suggestion.reason}
                                </p>
                                <button onClick={() => { haptic.light(); set({ goalWeight: String(suggestion.val) }); }}
                                    className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform shrink-0">
                                    Use
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 5: Activity ── */}
                {step === 5 && (
                    <div className="px-6 pt-4 pb-2 space-y-4">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">How active are you?</h2>
                            <p className="text-sm text-stone-400">Day-to-day movement, not counting workouts.</p>
                        </div>
                        <div className="space-y-3">
                            {[
                                { val:'sedentary', label:'Mostly sitting',    desc:'Desk job, minimal walking' },
                                { val:'light',     label:'Lightly active',    desc:'Some walking, on feet part of the day' },
                                { val:'moderate',  label:'Moderately active', desc:'On feet most of the day' },
                                { val:'active',    label:'Very active',       desc:'Physical job or active all day' },
                            ].map(({ val, label, desc }) => (
                                <button key={val} onClick={() => { haptic.light(); set({ activity: val }); }}
                                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                                        form.activity === val
                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                                        : 'border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900'
                                    }`}>
                                    <span className={`block font-bold text-sm ${form.activity === val ? 'text-violet-800 dark:text-violet-200' : 'text-stone-800 dark:text-stone-100'}`}>{label}</span>
                                    <span className="text-xs text-stone-500 dark:text-stone-400">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Step 6: Strength training ── */}
                {step === 6 && (
                    <div className="px-6 pt-4 pb-2 space-y-4">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">Do you lift?</h2>
                            <p className="text-sm text-stone-400">Strength training significantly changes your protein target.</p>
                        </div>
                        <div className="space-y-3">
                            {[
                                { val:'not_yet',   label:'Not really',        desc:"I'm starting simple." },
                                { val:'sometimes', label:'Sometimes',         desc:'A few times a month.' },
                                { val:'regular',   label:'Yes, 2+ days/week', desc:'This is part of my routine.' },
                            ].map(({ val, label, desc }) => (
                                <button key={val} onClick={() => { haptic.light(); set({ strengthTrainingLevel: val }); }}
                                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                                        form.strengthTrainingLevel === val
                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                                        : 'border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900'
                                    }`}>
                                    <span className={`block font-bold text-sm ${form.strengthTrainingLevel === val ? 'text-violet-800 dark:text-violet-200' : 'text-stone-800 dark:text-stone-100'}`}>{label}</span>
                                    <span className="text-xs text-stone-500 dark:text-stone-400">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Step 7: Blueprint ── */}
                {step === 7 && (
                    <div className="px-6 pt-4 pb-2 space-y-4">
                        <div>
                            <h2 className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 mb-1">Your Blueprint</h2>
                            <p className="text-sm text-stone-500">Science-based estimates. Adjust anytime in Settings.</p>
                        </div>
                        <div className="space-y-3">
                            {[
                                { icon:Utensils, label:'Protein',  val:`${calc.proteinTarget}g`, sub:`Range: ${calc.proteinMin}–${calc.proteinMax}g`, card:'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800', ic:'text-teal-700 dark:text-teal-300', vc:'text-violet-900 dark:text-violet-200' },
                                { icon:Flame,    label:'Calories', val:`${calc.calories}`,        sub:'Daily target',                                  card:'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', ic:'text-orange-600 dark:text-orange-400', vc:'text-orange-900 dark:text-orange-200' },
                                { icon:Droplet,  label:'Water',    val:`${calc.water}oz`,         sub:'Half your weight in oz',                        card:'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-800',       ic:'text-cyan-700 dark:text-cyan-400',   vc:'text-cyan-900 dark:text-cyan-200' },
                            ].map(({ icon:Icon, label, val, sub, card, ic, vc }) => (
                                <div key={label} className={`p-4 rounded-2xl border ${card} flex items-center justify-between`}>
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} className={ic} />
                                        <div>
                                            <div className="font-bold text-stone-700 dark:text-stone-200 text-sm">{label}</div>
                                            <div className="text-xs text-stone-400">{sub}</div>
                                        </div>
                                    </div>
                                    <div className={`text-2xl font-extrabold ${vc}`}>{val}</div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex items-center justify-center gap-1 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors mx-auto">
                            {isAdvancedOpen ? 'Hide' : 'Override targets'} {isAdvancedOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                        </button>
                        {isAdvancedOpen && (
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key:'manualProtein',  ph:`Pro: ${calc.proteinTarget}` },
                                    { key:'manualCalories', ph:`Cal: ${calc.calories}` },
                                    { key:'manualWater',    ph:`H₂O: ${calc.water}` },
                                ].map(({ key, ph }) => (
                                    <input key={key} type="number" inputMode="numeric" placeholder={ph}
                                        onChange={e => set({ [key]: e.target.value })}
                                        className="p-2 bg-stone-50 dark:bg-stone-800 text-sm rounded-xl text-center border-0 ring-1 ring-stone-100 dark:ring-stone-700 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>{/* end sliding content */}

            {/* Fixed footer — Back + Next/Accept */}
            {step === 1 && <Footer onNext={next} nextDisabled={safeInt(form.currentWeight) <= 0} />}
            {step === 2 && <Footer onNext={next} nextDisabled={safeInt(form.heightFt) <= 0} />}
            {step === 3 && <Footer onNext={next} nextDisabled={safeInt(form.age) <= 0} />}
            {step === 4 && <Footer onNext={next} nextDisabled={false} skipLabel="Skip — I'll set this later" onSkip={next} />}
            {step === 5 && <Footer onNext={next} nextDisabled={false} />}
            {step === 6 && <Footer onNext={next} nextDisabled={false} />}
            {step === 7 && (
                <Footer
                    onNext={() => {
                        haptic.success();
                        onComplete({
                            ...form,
                            targets: {
                                calories: safeInt(form.manualCalories) || calc.calories,
                                protein:  safeInt(form.manualProtein)  || calc.proteinTarget,
                                water:    safeInt(form.manualWater)    || calc.water,
                            },
                        });
                    }}
                    nextDisabled={false}
                    nextLabel="Accept & Start Tracking"
                    last
                />
            )}
        </div>
    );
};


const ProgressBar = ({ current, target, colorClass, icon: Icon, label, unit, showRatio, isOverBudget }) => {
    const t = safeInt(target) || 1;
    const c = safeInt(current);
    const percentage = Math.min(100, Math.max(0, (c / t) * 100));
    const isComplete = percentage >= 100;
    const overAmount = Math.max(0, c - t);

    // Over-budget overrides normal complete styling for calories
    const cardBorder = isOverBudget
        ? 'border-red-200 dark:border-red-800 shadow-md'
        : isComplete
        ? 'border-violet-200 dark:border-violet-800 shadow-md animate-pop'
        : 'border-stone-100 dark:border-stone-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)]';

    const fillColor = isOverBudget
        ? 'bg-red-400 dark:bg-red-500'
        : colorClass.fill;

    return (
        <div className={`bg-white dark:bg-stone-900 p-5 rounded-3xl border transition-all duration-500 relative overflow-hidden ${cardBorder}`}>
            {isComplete && !isOverBudget && (
                <div className="absolute top-2 right-2">
                    <Sparkles size={16} className="text-violet-500 animate-confetti" />
                </div>
            )}
            {isOverBudget && (
                <div className="absolute top-2 right-2">
                    <TrendingUp size={16} className="text-red-400" />
                </div>
            )}
            <div className="flex justify-between items-end mb-2 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${isOverBudget ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : `${colorClass.bg} ${colorClass.text} dark:bg-opacity-20`} ${isComplete && !isOverBudget ? 'animate-pulse-glow' : ''}`}>
                        {isOverBudget ? <TrendingUp size={18} /> : isComplete ? <Check size={18} /> : <Icon size={18} />}
                    </div>
                    <span className="font-medium text-stone-600 dark:text-stone-300">{label}</span>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-bold ${isOverBudget ? 'text-red-500 dark:text-red-400' : 'text-stone-800 dark:text-stone-100'}`}>{c}</span>
                    <span className="text-sm text-stone-400"> / {t}{unit}</span>
                </div>
            </div>
            <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded-full w-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out ${fillColor}`} style={{ width: `${percentage}%` }}/>
            </div>
            <div className="mt-2 text-xs text-stone-400 text-right font-medium flex justify-between items-center">
                {showRatio && c > 0 && (
                    <span className="text-stone-400">
                        {(c / Math.max(1, current)).toFixed(1)} cal/g
                    </span>
                )}
                <span className="ml-auto">
                    {isOverBudget
                        ? <span className="text-red-500 dark:text-red-400 font-bold">+{overAmount} over</span>
                        : isComplete
                        ? <span className="text-violet-600 dark:text-violet-300 font-bold">Goal Reached!</span>
                        : `${Math.round(100 - percentage)}% to go`
                    }
                </span>
            </div>
        </div>
    );
};

const AddFoodModal = ({ isOpen, onClose, onAdd, recentFoods, onSaveCustom, initialData }) => {
    const [mode, setMode] = useState('search');
    const [food, setFood] = useState({ name: '', protein: '', calories: '', note: '', portionTip: '' });
    const [customFood, setCustomFood] = useState({ name: '', protein: '', calories: '', portion: 'Custom' });
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);
    const suppressNextSuggestRef = useRef(false);

    useEffect(() => {
        if (suppressNextSuggestRef.current) {
            suppressNextSuggestRef.current = false;
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        if (!food.name || food.name.length < 2) { 
            setSuggestions([]); 
            setShowSuggestions(false);
            return; 
        }
        const allFoods = [...(recentFoods || []), ...FOOD_LIBRARY];
        const uniqueFoods = Array.from(new Map(allFoods.map(item => [item.name, item])).values());
        const matches = uniqueFoods.filter(item => item.name.toLowerCase().includes(food.name.toLowerCase()));
        setSuggestions(matches.slice(0, 5));
        setShowSuggestions(matches.length > 0);
    }, [food.name, recentFoods]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Pre-fill for editing
                setFood({
                    name: initialData.name,
                    protein: initialData.protein,
                    calories: initialData.calories,
                    note: initialData.note || '',
                    portionTip: ''
                });
                setMode('search'); // Use the main input form
            } else {
                setFood({ name: '', protein: '', calories: '', note: '', portionTip: '' });
                setSuggestions([]);
                setShowSuggestions(false);
                setMode('search');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSelectFood = (item) => {
        haptic.light();
        suppressNextSuggestRef.current = true;
        setFood({
            name: item.name,
            protein: item.protein,
            calories: item.calories,
            portionTip: item.portion,
            note: ''
        });
        setSuggestions([]);
        setShowSuggestions(false);
        // Blur input to dismiss keyboard
        inputRef.current?.blur();
    };

    const handleSaveCustom = async () => {
        if (!customFood.name || !customFood.protein || !customFood.calories) return;
        haptic.medium();
        await onSaveCustom(customFood);
        setMode('search');
        setFood({ name: customFood.name, protein: customFood.protein, calories: customFood.calories, note: '', portionTip: 'Custom' });
        setCustomFood({ name: '', protein: '', calories: '', portion: 'Custom' });
    };

    const handleSubmit = () => {
        haptic.success();
        onAdd({ 
            name: (food.name || 'Quick Add').trim(), 
            protein:  safeInt(food.protein), 
            calories: safeInt(food.calories), 
            note: food.note,
            loggedAt: Date.now()
        }); 
        setFood({ name: '', protein: '', calories: '', note: '', portionTip: '' }); 
        setShowSuggestions(false);
        onClose();
    };

    // At least one macro must be entered before submitting
    const canSubmit = safeInt(food.protein) > 0 || safeInt(food.calories) > 0;

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-zoom-in overflow-y-auto max-h-[90vh] border border-stone-200 dark:border-stone-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">
                        {initialData ? 'Edit Food' : 'Log Food'}
                    </h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 active:scale-90 transition-transform">
                        <X size={20}/>
                    </button>
                </div>
                {!initialData && (
                    <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl mb-4">
                        <button onClick={() => setMode('search')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'search' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-400'}`}>Search</button>
                        <button onClick={() => setMode('create')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'create' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-400'}`}>Create Food</button>
                    </div>
                )}
                {mode === 'search' ? (
                    <>
                        <div className="space-y-4 relative">
                            <div className="relative">
                                <input 
                                    ref={inputRef}
                                    placeholder="What did you eat?" 
                                    className="w-full p-4 pl-10 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 placeholder-stone-400 outline-none" 
                                    value={food.name} 
                                    onChange={e => setFood({...food, name: e.target.value})} 
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    onKeyDown={e => { if (e.key === 'Enter' && canSubmit) { setShowSuggestions(false); handleSubmit(); }}}
                                    autoFocus 
                                />
                                <Search size={18} className="absolute left-3 top-4 text-stone-400" />
                            </div>
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-14 left-0 right-0 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 shadow-xl rounded-2xl z-50 max-h-48 overflow-y-auto">
                                    {suggestions.map((item, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => handleSelectFood(item)} 
                                            className="w-full p-3 text-left hover:bg-stone-50 dark:hover:bg-stone-700 border-b border-stone-50 dark:border-stone-700 last:border-0 flex justify-between items-center text-stone-700 dark:text-stone-200 active:bg-stone-100 dark:active:bg-stone-600 transition-colors"
                                        >
                                            <span className="font-medium text-sm">{item.name}</span>
                                            <span className="text-xs text-stone-400">{item.protein}g • {item.calories} cal</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs text-stone-400 ml-1">Protein (g)</label>
                                    <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 font-bold text-stone-700 dark:text-stone-200 outline-none" value={food.protein} onChange={e => setFood({...food, protein: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-stone-400 ml-1">Calories</label>
                                    <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 font-bold text-stone-700 dark:text-stone-200 outline-none" value={food.calories} onChange={e => setFood({...food, calories: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }} />
                                </div>
                            </div>
                            {food.portionTip && (
                                <div className="bg-violet-50 dark:bg-violet-900/30 p-3 rounded-xl flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300">
                                    <Hand size={14} className="shrink-0" />
                                    <span><strong>Portion:</strong> {food.portionTip}</span>
                                </div>
                            )}
                            {food.protein && food.calories && safeInt(food.protein) > 0 && (
                                <div className="bg-stone-50 dark:bg-stone-800 p-3 rounded-xl text-xs text-stone-500 dark:text-stone-400 text-center">
                                    <span className="font-medium">{(safeInt(food.calories) / safeInt(food.protein)).toFixed(1)}</span> calories per gram of protein
                                </div>
                            )}
                        </div>
                        <button onClick={handleSubmit} disabled={!canSubmit} className="w-full mt-6 py-4 bg-stone-800 dark:bg-stone-700 text-stone-50 font-bold rounded-2xl shadow-lg shadow-stone-200 dark:shadow-none hover:bg-stone-700 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                            {initialData ? 'Save Changes' : 'Add Log'}
                        </button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-stone-400 ml-1">Food Name</label>
                            <input placeholder="e.g. Grandma's Lasagna" className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" value={customFood.name} onChange={e => setCustomFood({...customFood, name: e.target.value})} />
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-stone-400 ml-1">Protein (g)</label>
                                <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" value={customFood.protein} onChange={e => setCustomFood({...customFood, protein: e.target.value})} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-stone-400 ml-1">Calories</label>
                                <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border-0 focus:ring-2 focus:ring-violet-500 text-stone-800 dark:text-stone-100 outline-none" value={customFood.calories} onChange={e => setCustomFood({...customFood, calories: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={handleSaveCustom} className="w-full mt-2 py-4 bg-violet-500 text-white font-bold rounded-2xl shadow-lg hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 active:scale-95">
                            <Save size={18}/> Save & Select
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FoodLogList = ({ items, onDelete, onEdit, onMultiply }) => {
    const list = items || [];
    if (list.length === 0) return null;

    // Swipe-to-delete: track per-item touch start X
    const swipeStartX = useRef({});
    const [swipedIdx, setSwipedIdx] = useState(null);

    const handleTouchStart = (idx, e) => {
        swipeStartX.current[idx] = e.touches[0].clientX;
    };
    const handleTouchEnd = (idx, e) => {
        const startX = swipeStartX.current[idx];
        if (startX == null) return;
        const dx = startX - e.changedTouches[0].clientX;
        if (dx > 55) { haptic.light(); setSwipedIdx(idx); }
        else if (dx < -20) { setSwipedIdx(null); }
        delete swipeStartX.current[idx];
    };

    // Group by meal period
    const grouped = list.reduce((acc, item, idx) => {
        const period = getMealPeriod(item.loggedAt);
        if (!acc[period]) acc[period] = [];
        acc[period].push({ ...item, originalIndex: idx });
        return acc;
    }, {});
    
    const periodOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
    
    return (
        <div className="mt-8 animate-slide-up">
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 px-2">Today's Journal</h3>
            <div className="space-y-6">
                {periodOrder.map(period => {
                    const periodItems = grouped[period];
                    if (!periodItems || periodItems.length === 0) return null;
                    
                    const MealIcon = getMealIcon(period);
                    const periodTotals = computeTotals(periodItems);
                    
                    return (
                        <div key={period} className="space-y-2">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <MealIcon size={14} className="text-stone-400" />
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{getMealLabel(period)}</span>
                                </div>
                                <span className="text-xs text-stone-400">{periodTotals.protein}g • {periodTotals.calories} cal</span>
                            </div>
                            <div className="space-y-2">
                                {periodItems.map((item) => (
                                    <div
                                        key={item.originalIndex}
                                        className="relative overflow-hidden rounded-2xl"
                                        onTouchStart={e => handleTouchStart(item.originalIndex, e)}
                                        onTouchEnd={e => handleTouchEnd(item.originalIndex, e)}
                                    >
                                        {swipedIdx === item.originalIndex && (
                                            <button
                                                onClick={() => { setSwipedIdx(null); onDelete(item.originalIndex); }}
                                                className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center text-white font-bold text-sm active:bg-red-600 z-10 rounded-2xl"
                                            >
                                                Delete
                                            </button>
                                        )}
                                        <div
                                            className={`bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm transition-transform duration-200 ${swipedIdx === item.originalIndex ? '-translate-x-20' : 'translate-x-0'}`}
                                            onClick={() => swipedIdx === item.originalIndex ? setSwipedIdx(null) : null}
                                        >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-stone-700 dark:text-stone-200">{item.name}</span>
                                                    {item.loggedAt && (
                                                        <span className="text-[10px] text-stone-400">{formatTime(item.loggedAt)}</span>
                                                    )}
                                                    {item.servings && item.servings !== 1 && (
                                                        <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-md">×{item.servings}</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-stone-500 mt-1 flex gap-2 flex-wrap">
                                                    {item.protein > 0 && <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-lg font-medium">{item.protein}g Pro</span>}
                                                    {item.calories > 0 && <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-lg font-medium">{item.calories} Cal</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 ml-2 shrink-0">
                                                <button onClick={() => onEdit(item.originalIndex)} className="p-2 text-stone-300 hover:text-indigo-500 rounded-lg transition-colors active:scale-90">
                                                    <Edit3 size={15} />
                                                </button>
                                                <button onClick={() => onDelete(item.originalIndex)} className="p-2 text-stone-300 hover:text-red-500 rounded-lg transition-colors active:scale-90">
                                                    <X size={15} />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Serving multiplier row */}
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-50 dark:border-stone-800">
                                            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium shrink-0">Servings</span>
                                            <div className="flex items-center gap-1">
                                                {[0.5, 1, 1.5, 2].map(mult => {
                                                    const baseProtein  = item.baseProtein  ?? item.protein;
                                                    const baseCalories = item.baseCalories ?? item.calories;
                                                    const currentServings = item.servings ?? 1;
                                                    const isActive = Math.abs(currentServings - mult) < 0.01;
                                                    return (
                                                        <button
                                                            key={mult}
                                                            onClick={() => { haptic.light(); onMultiply(item.originalIndex, mult, baseProtein, baseCalories); }}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-90 ${
                                                                isActive
                                                                ? 'bg-stone-800 dark:bg-stone-600 text-white'
                                                                : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                                                            }`}
                                                        >
                                                            {mult === 0.5 ? '½' : mult === 1 ? '1×' : mult === 1.5 ? '1½' : '2×'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        </div>{/* end swipe inner */}
                                    </div>{/* end swipe outer */}
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EmptyState = ({ onAddClick, suggestions, onGoLearn }) => {
    // Pick a deterministic "food of the day" based on calendar date
    const todayIndex = new Date().getDate() % FOOD_LIBRARY.length;
    const featuredFood = FOOD_LIBRARY[todayIndex];
    const efficiency = (featuredFood.protein / featuredFood.calories * 100).toFixed(1);

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Food of the day — bridges empty state to the Learn tab */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-violet-500" />
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Protein Pick of the Day</span>
                    </div>
                    <button
                        onClick={onGoLearn}
                        className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                        See all →
                    </button>
                </div>
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-900/20 rounded-2xl">
                        <div>
                            <div className="font-bold text-stone-800 dark:text-stone-100 text-sm">{featuredFood.name}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-2">
                                <span>≈ {featuredFood.portion}</span>
                                <span className="bg-white dark:bg-stone-800 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium">{efficiency}g pro/100cal</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-violet-700 dark:text-violet-300 text-lg">{featuredFood.protein}g</div>
                            <div className="text-xs text-stone-400">{featuredFood.calories} cal</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick-add suggestions */}
            <div className="text-center py-4">
                <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Utensils size={24} className="text-stone-400" />
                </div>
                <h3 className="text-base font-bold text-stone-700 dark:text-stone-200 mb-1">Nothing logged yet</h3>
                <p className="text-sm text-stone-400 mb-4">Tap below to add your first meal</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.slice(0, 3).map((food, idx) => (
                        <button
                            key={idx}
                            onClick={() => onAddClick(food)}
                            className="px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-600 dark:text-stone-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors active:scale-95"
                        >
                            {food.name.split(' (')[0]} <span className="text-violet-600 dark:text-violet-300">+{food.protein}g</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Learn tab entry point */}
            <button
                onClick={onGoLearn}
                className="w-full p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-transform"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-stone-800 rounded-xl text-cyan-700 dark:text-cyan-300">
                        <BookOpen size={18} />
                    </div>
                    <div className="text-left">
                        <div className="font-bold text-stone-800 dark:text-stone-100 text-sm">Not sure what to log?</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">Browse the food guide & fast food cheat sheet</div>
                    </div>
                </div>
                <ChevronRight size={18} className="text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors shrink-0" />
            </button>
        </div>
    );
};

const WeeklyView = ({ userId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weightHistory, setWeightHistory] = useState([]);
    const [weeklyInsight, setWeeklyInsight] = useState(null);

    useEffect(() => {
        const getPastDates = () => {
            const dates = [];
            for (let i = 6; i >= 0; i--) { 
                const d = new Date(); 
                d.setDate(d.getDate() - i); 
                dates.push(d.toISOString().split('T')[0]); 
            }
            return dates;
        };
        
        const last7 = getPastDates().map(date => {
            const dayLog = DB.getLog(date);
            if (dayLog && dayLog.items) {
                const totals = computeTotals(dayLog.items);
                return { date, ...totals, water: dayLog.water || 0, items: dayLog.items };
            }
            return { date, protein: 0, calories: 0, water: 0, items: [] };
        }).reverse();
        
        setHistory(last7);
        setWeightHistory(DB.getWeightHistory());
        
        // Calculate weekly insight
        const thisWeekProtein = last7.slice(0, 7).reduce((a, b) => a + (b.protein || 0), 0);
        const prevWeekDates = [];
        for (let i = 13; i >= 7; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            prevWeekDates.push(d.toISOString().split('T')[0]);
        }
        const prevWeekProtein = prevWeekDates.reduce((sum, date) => {
            const log = DB.getLog(date);
            if (log && log.items) {
                return sum + computeTotals(log.items).protein;
            }
            return sum;
        }, 0);
        
        if (prevWeekProtein > 0) {
            const change = ((thisWeekProtein - prevWeekProtein) / prevWeekProtein * 100).toFixed(0);
            if (change > 0) {
                setWeeklyInsight({ type: 'up', value: change, message: 'More protein than last week!' });
            } else if (change < -10) {
                setWeeklyInsight({ type: 'down', value: Math.abs(change), message: 'Less protein than last week' });
            }
        }
        
        setLoading(false);
    }, [userId]);

    if (loading) return <div className="p-8 text-center text-stone-400">Loading history...</div>;
    
    const avgProtein = Math.round(history.reduce((a, b) => a + (b.protein || 0), 0) / 7);
    const avgCalories = Math.round(history.reduce((a, b) => a + (b.calories || 0), 0) / 7);
    const daysLogged = history.filter(d => d.protein > 0 || d.calories > 0).length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-violet-50 dark:bg-violet-900/20 p-6 rounded-3xl border border-violet-100 dark:border-violet-800">
                <h3 className="text-teal-700 dark:text-teal-300 font-bold mb-2">Consistency {'>'} Compensation</h3>
                <p className="text-violet-700 dark:text-violet-300 text-sm leading-relaxed">Your average matters more than any single day. You're building momentum, not chasing perfection.</p>
            </div>
            
            {weeklyInsight && (
                <div className={`p-4 rounded-2xl border ${weeklyInsight.type === 'up' ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'}`}>
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className={weeklyInsight.type === 'up' ? 'text-violet-600' : 'text-amber-600'} />
                        <span className={`font-bold ${weeklyInsight.type === 'up' ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}`}>
                            {weeklyInsight.value}% {weeklyInsight.type === 'up' ? '↑' : '↓'}
                        </span>
                        <span className="text-stone-600 dark:text-stone-400 text-sm">{weeklyInsight.message}</span>
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm text-center">
                    <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Avg Protein</div>
                    <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{avgProtein}g</div>
                </div>
                <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm text-center">
                    <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Avg Calories</div>
                    <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{avgCalories}</div>
                </div>
                <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm text-center">
                    <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Days Logged</div>
                    <div className="text-2xl font-bold text-stone-800 dark:text-stone-100">{daysLogged}/7</div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm">
                <h4 className="font-bold text-stone-700 dark:text-stone-200 mb-6">Last 7 Days</h4>
                <div className="flex justify-between items-end h-32 gap-2">
                    {history.map((day, i) => {
                        const heightPct = Math.min(100, (day.calories / 3000) * 100);
                        const isToday = day.date === getTodayStr();
                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="w-full relative h-full flex items-end bg-stone-50 dark:bg-stone-800 rounded-lg overflow-hidden">
                                    <div className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-violet-500 dark:bg-violet-500' : 'bg-stone-300 dark:bg-stone-700 group-hover:bg-stone-400'}`} style={{ height: `${heightPct}%` }}/>
                                </div>
                                <span className="text-[10px] text-stone-400 font-medium">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <WeightGraph data={weightHistory} />
        </div>
    );
};

// --- FAST FOOD GUIDE COMPONENT ---
const FastFoodGuide = ({ onLogFood }) => {
    const [selectedChain, setSelectedChain] = useState(null);
    const chains = Object.entries(FAST_FOOD_DATA);
    
    const getBadgeStyle = (badge) => {
        switch(badge) {
            case 'best': return 'bg-teal-100 dark:bg-teal-900/40 text-violet-700 dark:text-violet-300';
            case 'solid': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
            case 'aware': return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
            default: return 'bg-stone-100 text-stone-600';
        }
    };
    
    const getBadgeLabel = (badge) => {
        switch(badge) {
            case 'best': return '🏆 Best bet';
            case 'solid': return '✓ Solid';
            case 'aware': return '👀 Be aware';
            default: return '';
        }
    };

    if (selectedChain) {
        const chain = FAST_FOOD_DATA[selectedChain];
        return (
            <div className="animate-slide-right">
                <button onClick={() => setSelectedChain(null)} className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-4 hover:text-stone-700 dark:hover:text-stone-200 active:scale-95 transition-transform">
                    <ChevronLeft size={18} /> Back to chains
                </button>
                
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 ${chain.color} rounded-2xl flex items-center justify-center text-white font-bold text-lg`}>
                        {chain.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">{chain.name}</h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Tap any item to log it</p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {chain.items.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                haptic.success();
                                onLogFood({
                                    name: `${chain.name} - ${item.name}`,
                                    protein: item.protein,
                                    calories: item.calories,
                                    loggedAt: Date.now()
                                });
                            }}
                            className="w-full bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm text-left hover:border-violet-200 dark:hover:border-violet-800 transition-all active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-stone-800 dark:text-stone-100">{item.name}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getBadgeStyle(item.badge)}`}>
                                            {getBadgeLabel(item.badge)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{item.note}</p>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className="font-bold text-violet-600 dark:text-violet-300">{item.protein}g</div>
                                    <div className="text-xs text-stone-400">{item.calories} cal</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-violet-600 dark:text-violet-300 text-xs font-medium">
                                <Plus size={12} /> Tap to log
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-3xl border border-orange-100 dark:border-orange-800">
                <h3 className="text-orange-800 dark:text-orange-300 font-bold mb-2 flex items-center gap-2">
                    <Store size={18} /> Real food for real life
                </h3>
                <p className="text-orange-700 dark:text-orange-400 text-sm leading-relaxed">
                    Sometimes fast food happens. Here's how to make the best of it - no judgment, just smart choices.
                </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {chains.map(([key, chain]) => (
                    <button
                        key={key}
                        onClick={() => { haptic.light(); setSelectedChain(key); }}
                        className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:border-stone-200 dark:hover:border-stone-700 transition-all active:scale-95 text-left"
                    >
                        <div className={`w-10 h-10 ${chain.color} rounded-xl flex items-center justify-center text-white font-bold mb-2`}>
                            {chain.name.charAt(0)}
                        </div>
                        <div className="font-bold text-stone-800 dark:text-stone-100 text-sm">{chain.name}</div>
                        <div className="text-xs text-stone-400">{chain.items.length} items</div>
                    </button>
                ))}
            </div>
            
            <div className="bg-stone-50 dark:bg-stone-800 p-5 rounded-2xl mt-6">
                <h4 className="font-bold text-stone-700 dark:text-stone-200 mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-amber-500" /> Universal Tips
                </h4>
                <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                    <li className="flex gap-2"><span>🍗</span> <span><strong>Grilled beats crispy</strong> - saves 100-200 cal usually</span></li>
                    <li className="flex gap-2"><span>🥤</span> <span><strong>Drinks add up fast</strong> - water or unsweetened saves 200+ cal</span></li>
                    <li className="flex gap-2"><span>🍟</span> <span><strong>Fries are the real bomb</strong> - skip, split, or get small</span></li>
                    <li className="flex gap-2"><span>🥗</span> <span><strong>Sauce on the side</strong> - you control the pour</span></li>
                    <li className="flex gap-2"><span>📦</span> <span><strong>Big meal? Save half</strong> - it's two meals, not one</span></li>
                </ul>
            </div>
        </div>
    );
};

// --- LEARN VIEW (with tabs for Basics and Fast Food) ---
const LearnView = ({ proteinRemaining, caloriesRemaining, onLogFood }) => {
    const [activeTab, setActiveTab] = useState('basics');
    const [filter, setFilter] = useState('all');
    
    // Sort by protein efficiency (protein per calorie)
    const sortedFoods = useMemo(() => {
        return [...FOOD_LIBRARY].sort((a, b) => {
            const effA = a.protein / a.calories;
            const effB = b.protein / b.calories;
            return effB - effA;
        });
    }, []);
    
    // Filter based on what user needs
    const contextualFoods = useMemo(() => {
        if (filter === 'high-protein') {
            return sortedFoods.filter(f => f.protein >= 20);
        } else if (filter === 'low-cal') {
            return sortedFoods.filter(f => f.calories <= 150);
        } else if (filter === 'quick') {
            return sortedFoods.filter(f => ['Egg', 'Greek Yogurt', 'Protein Powder', 'Cheese', 'Almonds'].some(q => f.name.includes(q)));
        }
        return sortedFoods;
    }, [sortedFoods, filter]);
    
    // Show contextual suggestion if user is short on protein
    const showSuggestion = proteinRemaining > 20;

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Tab Switcher */}
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('basics')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'basics' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500'}`}
                >
                    <BookOpen size={16} /> Basics
                </button>
                <button
                    onClick={() => setActiveTab('fastfood')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'fastfood' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-800 dark:text-stone-100' : 'text-stone-500'}`}
                >
                    <Store size={16} /> Dining Out
                </button>
            </div>
            
            {activeTab === 'basics' ? (
                <>
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 p-6 rounded-3xl border border-cyan-100 dark:border-cyan-800">
                        <h3 className="text-cyan-800 dark:text-cyan-300 font-bold mb-2 flex items-center gap-2">
                            <BookOpen size={18} />Learn this once. Use it forever.
                        </h3>
                        <p className="text-cyan-700 dark:text-cyan-400 text-sm leading-relaxed">These are mental anchors. You don't need a database if you know the basics.</p>
                    </div>
                    
                    {showSuggestion && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
                                <span className="font-bold text-amber-800 dark:text-amber-300 text-sm">Need {proteinRemaining}g more protein?</span>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Try filtering by "High Protein" below for the best options.</p>
                        </div>
                    )}
                    
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {['all', 'high-protein', 'low-cal', 'quick'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${filter === f ? 'bg-stone-800 dark:bg-stone-700 text-white' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
                            >
                                {f === 'all' ? 'All Foods' : f === 'high-protein' ? '🥩 High Protein' : f === 'low-cal' ? '🥗 Low Cal' : '⚡ Quick'}
                            </button>
                        ))}
                    </div>
                    
                    <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                        {contextualFoods.map((food, idx) => {
                            const efficiency = (food.protein / food.calories * 100).toFixed(1);
                            return (
                                <div key={idx} className="flex justify-between items-center p-4 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                                    <div>
                                        <div className="font-medium text-stone-700 dark:text-stone-200">{food.name}</div>
                                        <div className="text-[10px] text-stone-400 flex items-center gap-2">
                                            <span>≈ {food.portion}</span>
                                            <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded">{efficiency}g pro/100cal</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-violet-700 dark:text-violet-300">{food.protein}g</div>
                                        <div className="text-xs text-stone-400">{food.calories} cal</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <FastFoodGuide onLogFood={onLogFood} />
            )}
        </div>
    );
};

// Legacy CheatSheet for backwards compatibility
const CheatSheet = ({ proteinRemaining, caloriesRemaining, onLogFood }) => {
    return <LearnView proteinRemaining={proteinRemaining} caloriesRemaining={caloriesRemaining} onLogFood={onLogFood} />;
};

// --- MAIN APP COMPONENT ---

// ── INSTALL PROMPT ───────────────────────────────────────────────────────────
// Shown once after first log entry. Detects platform and gives right instructions.
// Stored in localStorage so it only shows once.
const InstallPrompt = ({ onDismiss }) => {
    const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true;

    // Don't show if already installed
    if (isStandalone) { onDismiss(); return null; }

    const instructions = isIOS
        ? [{ icon: '↑', text: 'Tap the Share button in Safari' }, { icon: '⊞', text: 'Tap "Add to Home Screen"' }, { icon: '✓',  text: 'Tap "Add" — done!' }]
        : isAndroid
        ? [{ icon: '⋮', text: 'Tap the menu in Chrome (top right)' }, { icon: '⊞', text: 'Tap "Add to Home Screen"' }, { icon: '✓',  text: 'Tap "Add" — done!' }]
        : [{ icon: '⊞', text: 'Use your browser's "Install" or "Add to Home Screen" option' }];

    return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-end justify-center p-4 z-[70] animate-fade-in">
            <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl border border-stone-100 dark:border-stone-800 animate-slide-in-up overflow-hidden">
                {/* Header strip */}
                <div className="bg-gradient-to-r from-violet-600 to-teal-500 p-5 flex items-center gap-4">
                    {/* Mini bar chart icon */}
                    <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-end justify-center gap-1 p-2 flex-shrink-0">
                        <div className="w-2 bg-white/60 rounded-sm" style={{height:'40%'}}></div>
                        <div className="w-2 bg-white/80 rounded-sm" style={{height:'65%'}}></div>
                        <div className="w-2 bg-white rounded-sm"    style={{height:'90%'}}></div>
                    </div>
                    <div>
                        <div className="text-white font-extrabold text-base">Install Steady</div>
                        <div className="text-white/75 text-xs">Add to your home screen</div>
                    </div>
                </div>
                {/* Body */}
                <div className="p-5">
                    <p className="text-sm text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
                        Steady works best as a home screen app — faster to open, feels native, and keeps your data right on your device.
                    </p>
                    <div className="space-y-3 mb-5">
                        {instructions.map(({ icon, text }, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-300 font-bold text-sm flex-shrink-0">
                                    {icon}
                                </div>
                                <span className="text-sm text-stone-700 dark:text-stone-300">{text}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onDismiss}
                            className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-bold rounded-xl text-sm active:scale-95 transition-transform">
                            Maybe Later
                        </button>
                        <button onClick={onDismiss}
                            className="flex-1 py-3 bg-stone-800 dark:bg-stone-700 text-white font-bold rounded-xl text-sm active:scale-95 transition-transform">
                            Got It
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Steady = () => {
    const [profile, setProfile] = useState(DB.getProfile());
    const [selectedDate, setSelectedDate] = useState(getTodayStr());
    const [logs, setLogs] = useState(null);
    const [view, setView] = useState('dashboard');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [recentFoods, setRecentFoods] = useState(DB.getRecentFoods());
    const [toast, setToast] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [streakAnimating, setStreakAnimating] = useState(false);
    const viewChangeRef = useRef(false);
    const dateChangeRef = useRef(false);

    // NEW: State for editing item
    const [editingItem, setEditingItem] = useState(null);

    // Initialize logs
    useEffect(() => {
        const dayLog = DB.getLog(selectedDate);
        setLogs(dayLog || { water: 0, items: [] });
    }, [selectedDate]);

    useEffect(() => {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) setIsDark(true);
        if (profile && profile.lastWeightUpdate) {
            const days = daysSince(profile.lastWeightUpdate);
            if (days > 14) setShowWeightModal(true);
        }
    }, []);

    useEffect(() => {
        if (!__ga.loadedSent) {
            __ga.loadedSent = true;
            trackEvent('app_loaded');
        }
        if (!__ga.started) {
            __ga.started = true;
            trackEvent('session_start');
        }
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && !__ga.endedSent) {
                __ga.endedSent = true;
                trackEvent('session_end', { reason: 'hidden' });
            }
        };
        const handleUnload = () => {
            if (!__ga.endedSent) {
                __ga.endedSent = true;
                trackEvent('session_end', { reason: 'unload' });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, []);

    useEffect(() => {
        if (!viewChangeRef.current) {
            viewChangeRef.current = true;
            return;
        }
        trackEvent('view_changed', { view });
    }, [view]);

    useEffect(() => {
        if (!dateChangeRef.current) {
            dateChangeRef.current = true;
            return;
        }
        trackEvent('date_changed', { date: selectedDate });
    }, [selectedDate]);

    useEffect(() => { 
        document.documentElement.classList.toggle('dark', isDark); 
    }, [isDark]);

    // Compute totals from items
    const totals = useMemo(() => {
        if (!logs) return { protein: 0, calories: 0 };
        return computeTotals(logs.items);
    }, [logs]);

    const updateLog = useCallback((newData) => {
        const merged = { ...logs, ...newData };
        setLogs(merged);
        DB.saveLog(selectedDate, merged);
        
        // Fixed streak logic - only increment for consecutive days
        if (selectedDate === getTodayStr() && profile) {
            if (profile.lastLogDate !== selectedDate) {
                let newStreak = 1;
                if (isConsecutiveDay(profile.lastLogDate, selectedDate)) {
                    newStreak = (profile.currentStreak || 0) + 1;
                    setStreakAnimating(true);
                    setTimeout(() => setStreakAnimating(false), 600);
                }
                const newProfile = { ...profile, lastLogDate: selectedDate, currentStreak: newStreak };
                setProfile(newProfile);
                DB.saveProfile(newProfile);
            }
        }
    }, [logs, selectedDate, profile]);

    const handleAdd = useCallback((food) => {
        if (editingItem) {
            // Logic for Saving an Edit
            const newItems = [...logs.items];
            newItems[editingItem.index] = { ...food, loggedAt: editingItem.item.loggedAt };
            updateLog({ items: newItems });
            trackEvent('food_edited', {
                calories: safeNum(food.calories),
                protein: safeNum(food.protein),
                date: selectedDate,
                view
            });
            setEditingItem(null);
            setToast({ message: `Updated ${food.name.split(' (')[0]}`, type: 'success' });
        } else {
            // Logic for Adding New — stamp base values for serving multiplier
            const newFood = { ...food, servings: 1, baseProtein: safeInt(food.protein), baseCalories: safeInt(food.calories) };
            const newItems = [...(logs?.items || []), newFood];
            updateLog({ items: newItems });
            trackEvent('food_logged', {
                calories: safeNum(food.calories),
                protein: safeNum(food.protein),
                is_quick_add: false,
                date: selectedDate,
                view
            });
            
            if (food.name && food.name !== 'Quick Add') {
                DB.addRecentFood(food);
                setRecentFoods(DB.getRecentFoods());
            }
            setToast({ message: `Added ${food.name.split(' (')[0]}`, type: 'success' });
            // Show install prompt on first-ever food log if not already installed
            const hasSeenInstall = localStorage.getItem('steady_install_seen');
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            if (!hasSeenInstall && !isStandalone) {
                setTimeout(() => setShowInstallPrompt(true), 800);
                localStorage.setItem('steady_install_seen', '1');
            }
        }
    }, [logs, updateLog, editingItem, selectedDate, view]);

    const handleEditClick = useCallback((index) => {
        const item = logs.items[index];
        setEditingItem({ item, index });
        setShowAddModal(true);
    }, [logs]);

    const handleMultiply = useCallback((index, multiplier, baseProtein, baseCalories) => {
        const newItems = [...logs.items];
        const item = newItems[index];
        newItems[index] = {
            ...item,
            servings: multiplier,
            baseProtein:  baseProtein,
            baseCalories: baseCalories,
            protein:  Math.round(baseProtein  * multiplier),
            calories: Math.round(baseCalories * multiplier),
        };
        updateLog({ items: newItems });
    }, [logs, updateLog]);

    const handleQuickAdd = useCallback((food) => {
        // Quick add always adds new, never edits
        const newFood = { ...food, loggedAt: Date.now(), servings: 1, baseProtein: safeInt(food.protein), baseCalories: safeInt(food.calories) };
        // We manually call the add logic here instead of handleAdd to avoid edit state confusion
        const newItems = [...(logs?.items || []), newFood];
        updateLog({ items: newItems });
        trackEvent('food_logged', {
            calories: safeNum(food.calories),
            protein: safeNum(food.protein),
            is_quick_add: true,
            date: selectedDate,
            view
        });
        if (food.name && food.name !== 'Quick Add') {
            DB.addRecentFood(food);
            setRecentFoods(DB.getRecentFoods());
        }
        setToast({ message: `Added ${food.name.split(' (')[0]}`, type: 'success' });
    }, [logs, updateLog, selectedDate, view]);

    const handleCopyYesterday = useCallback(() => {
        const yesterdayLog = DB.getLog(getYesterdayStr());
        if (yesterdayLog && yesterdayLog.items && yesterdayLog.items.length > 0) {
            haptic.success();
            const copiedItems = yesterdayLog.items.map(item => ({
                ...item,
                loggedAt: Date.now()
            }));
            updateLog({ items: [...(logs?.items || []), ...copiedItems] });
            setToast({ message: `Copied ${copiedItems.length} items from yesterday`, type: 'success' });
        }
    }, [logs, updateLog, selectedDate, view]);

    const handleSaveCustom = useCallback((customFood) => {
        DB.addRecentFood(customFood);
        setRecentFoods(DB.getRecentFoods());
    }, []);

    const handleDelete = useCallback((idx) => {
        haptic.light();
        const item = logs.items[idx];
        const newItems = logs.items.filter((_, i) => i !== idx);
        
        // Save to undo stack
        setUndoStack(prev => [...prev, { item, index: idx }]);
        
        updateLog({ items: newItems });
        trackEvent('food_deleted', {
            date: selectedDate,
            view
        });
        
        setToast({
            message: `Removed ${item.name}`,
            action: 'Undo',
            type: 'info'
        });
    }, [logs, updateLog, selectedDate, view]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        haptic.medium();
        const lastUndo = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        
        const newItems = [...(logs?.items || [])];
        newItems.splice(lastUndo.index, 0, lastUndo.item);
        updateLog({ items: newItems });
        trackEvent('food_delete_undone', {
            date: selectedDate,
            view
        });
        setToast(null);
    }, [undoStack, logs, updateLog, selectedDate, view]);
    
    const handleWater = useCallback((amt) => {
        haptic.light();
        updateLog({ water: Math.max(0, (logs?.water || 0) + amt) });
    }, [logs, updateLog]);

    const handleUpdateWeight = useCallback((w) => {
        const newProfile = { ...profile, currentWeight: safeInt(w), lastWeightUpdate: getTodayStr() };
        setProfile(newProfile);
        DB.saveProfile(newProfile);
        DB.saveWeightLog({ date: getTodayStr(), weight: safeInt(w) });
        trackEvent('weight_logged');
    }, [profile]);

    const changeDate = useCallback((days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    }, [selectedDate]);

    // Get yesterday's items for copy feature
    const yesterdayLog = useMemo(() => DB.getLog(getYesterdayStr()), []);
    const yesterdayItems = yesterdayLog?.items || [];

    // Onboarding screen (no profile yet)
    if (!profile) {
        return (
            <div className="fixed inset-0 bg-[#FDFBF7] dark:bg-stone-950 flex items-center justify-center">
                <div className="w-full h-full max-w-lg mx-auto bg-white dark:bg-stone-900 shadow-2xl overflow-y-auto smooth-scroll">
                    <Onboarding onComplete={(p) => { setProfile(p); DB.saveProfile(p); }} />
                </div>
            </div>
        );
    }

    if (!logs) return null; // Loading state

    const targets = { 
        calories: safeInt(profile.targets?.calories) || 2000, 
        protein: safeInt(profile.targets?.protein) || 150, 
        water: safeInt(profile.targets?.water) || 100 
    };
    
    const proteinRemaining  = Math.max(0, targets.protein  - totals.protein);
    const caloriesRemaining = Math.max(0, targets.calories - totals.calories);
    const caloriesOver      = Math.max(0, totals.calories  - targets.calories);

    return (
        <div className="fixed inset-0 flex flex-col bg-[#FDFBF7] dark:bg-stone-950">
            {/* App Container - centered with max width for tablets */}
            <div className="w-full h-full max-w-lg mx-auto bg-white dark:bg-stone-900 shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header - Fixed */}
                <header className="flex-none bg-white dark:bg-stone-900 px-6 pt-4 pb-4 border-b border-stone-100 dark:border-stone-800 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Steady</h1>
                            {profile.currentStreak > 0 && (
                                <div className={`flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs font-bold ${streakAnimating ? 'animate-streak' : ''}`}>
                                    <Flame size={12} fill="currentColor"/> {profile.currentStreak}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setView('settings')} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-2 -mr-2 active:scale-90 transition-transform">
                            <Settings size={20}/>
                        </button>
                    </div>
                    {view === 'dashboard' && (
                        <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-800 p-1 rounded-xl">
                            <button onClick={() => changeDate(-1)} className="p-2 text-stone-400 hover:bg-white dark:hover:bg-stone-700 rounded-lg active:scale-90 transition-transform">
                                <ChevronLeft size={18}/>
                            </button>
                            <div className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-300">
                                <Calendar size={14} />
                                <button
                                    onClick={() => { if (selectedDate !== getTodayStr()) { haptic.light(); setSelectedDate(getTodayStr()); }}}
                                    className={selectedDate !== getTodayStr() ? 'text-violet-600 dark:text-violet-400 underline underline-offset-2 decoration-dotted' : ''}
                                >
                                    {formatDateDisplay(selectedDate)}
                                </button>
                                {selectedDate !== getTodayStr() && (
                                    <span className="text-[10px] font-normal text-stone-400">tap to return</span>
                                )}
                            </div>
                            <button onClick={() => changeDate(1)} disabled={selectedDate === getTodayStr()} className="p-2 text-stone-400 hover:bg-white dark:hover:bg-stone-700 rounded-lg disabled:opacity-30 active:scale-90 transition-transform">
                                <ChevronRight size={18}/>
                            </button>
                        </div>
                    )}
                </header>

                {/* Main Content - Scrollable */}
                <main className="flex-1 overflow-y-auto smooth-scroll scrollbar-hide">
                    <div className="p-4 pb-6 space-y-4">
                        {view === 'dashboard' && (
                            <div className="space-y-4 animate-slide-up">

                                {/* ── TIER 1: The day at a glance ─────────────────────
                                     Three stats side-by-side at the top — the numbers are 
                                     the hero. Big, readable, instant context on open.
                                ─────────────────────────────────────────────────────── */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Protein */}
                                    <div className={`bg-white dark:bg-stone-900 p-4 rounded-2xl border transition-all duration-500 ${totals.protein >= targets.protein ? 'border-violet-200 dark:border-violet-700' : 'border-stone-100 dark:border-stone-800'}`}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Utensils size={13} className="text-teal-600 dark:text-teal-400" />
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Protein</span>
                                        </div>
                                        <div className="mb-2">
                                            <span className={`text-2xl font-extrabold ${totals.protein >= targets.protein ? 'text-violet-600 dark:text-violet-300' : 'text-stone-800 dark:text-stone-100'}`}>{totals.protein}</span>
                                            <span className="text-xs text-stone-400 ml-1">/ {targets.protein}g</span>
                                        </div>
                                        <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${totals.protein >= targets.protein ? 'bg-violet-500' : 'bg-violet-400'}`}
                                                 style={{ width: `${Math.min(100,(totals.protein/targets.protein)*100)}%` }}/>
                                        </div>
                                        {totals.protein >= targets.protein && (
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <Check size={10} className="text-violet-500"/>
                                                <span className="text-[9px] font-bold text-violet-500">Hit!</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Calories */}
                                    <div className={`bg-white dark:bg-stone-900 p-4 rounded-2xl border transition-all duration-500 ${caloriesOver > 0 ? 'border-red-200 dark:border-red-800' : 'border-stone-100 dark:border-stone-800'}`}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Flame size={13} className={caloriesOver > 0 ? 'text-red-500' : 'text-orange-500'} />
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Calories</span>
                                        </div>
                                        <div className="mb-2">
                                            <span className={`text-2xl font-extrabold ${caloriesOver > 0 ? 'text-red-500 dark:text-red-400' : 'text-stone-800 dark:text-stone-100'}`}>{totals.calories}</span>
                                            <span className="text-xs text-stone-400 ml-1">/ {targets.calories}</span>
                                        </div>
                                        <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${caloriesOver > 0 ? 'bg-red-400' : 'bg-orange-400'}`}
                                                 style={{ width: `${Math.min(100,(totals.calories/targets.calories)*100)}%` }}/>
                                        </div>
                                        {caloriesOver > 0 && (
                                            <span className="text-[9px] font-bold text-red-500 mt-1 block">+{caloriesOver} over</span>
                                        )}
                                    </div>

                                    {/* Water — compact, tap to expand buttons */}
                                    <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 transition-all duration-500">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Droplet size={13} className="text-cyan-500" />
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Water</span>
                                        </div>
                                        <div className="mb-2">
                                            <span className="text-2xl font-extrabold text-stone-800 dark:text-stone-100">{logs.water || 0}</span>
                                            <span className="text-xs text-stone-400 ml-1">oz</span>
                                        </div>
                                        <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000 ease-out bg-cyan-400"
                                                 style={{ width: `${Math.min(100,((logs.water||0)/targets.water)*100)}%` }}/>
                                        </div>
                                        <span className="text-[9px] text-stone-400 mt-1 block">of {targets.water}oz</span>
                                    </div>
                                </div>

                                {/* Water quick-add — compact single row, lives right under the stats */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-stone-400 shrink-0 pl-1">Water</span>
                                    <div className="flex-1 flex gap-2">
                                        <button onClick={() => handleWater(8)}  className="flex-1 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 font-bold rounded-xl text-xs active:scale-95 transition-transform">+8oz</button>
                                        <button onClick={() => handleWater(16)} className="flex-1 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 font-bold rounded-xl text-xs active:scale-95 transition-transform">+16oz</button>
                                        <button onClick={() => handleWater(32)} className="flex-1 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 font-bold rounded-xl text-xs active:scale-95 transition-transform">+32oz</button>
                                        <button onClick={() => handleWater(-8)} className="w-9 py-2 bg-stone-100 dark:bg-stone-800 text-stone-500 font-bold rounded-xl text-xs flex items-center justify-center active:scale-95 transition-transform shrink-0">
                                            <Minus size={14}/>
                                        </button>
                                    </div>
                                </div>

                                {/* ── Insight card — only shows when relevant ── */}
                                {selectedDate === getTodayStr() && (
                                    <InsightCard 
                                        proteinRemaining={proteinRemaining} 
                                        caloriesRemaining={caloriesRemaining}
                                        caloriesOver={caloriesOver}
                                        proteinTarget={targets.protein}
                                    />
                                )}

                                {/* ── TIER 2: Actions ─────────────────────────────────
                                     Log Meal is the primary CTA — full width, prominent.
                                     Quick Add lives directly beneath as a secondary action.
                                ─────────────────────────────────────────────────────── */}
                                <button onClick={() => { haptic.medium(); setEditingItem(null); setShowAddModal(true); }} className="w-full py-4 bg-stone-800 dark:bg-stone-700 text-stone-50 font-bold rounded-2xl shadow-lg shadow-stone-200/60 dark:shadow-none hover:bg-stone-700 dark:hover:bg-stone-600 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                                    <Plus size={20} /> Log Meal
                                </button>

                                {selectedDate === getTodayStr() && (
                                    <QuickLogSection 
                                        yesterdayItems={yesterdayItems}
                                        onCopyYesterday={handleCopyYesterday}
                                    />
                                )}

                                {/* ── TIER 3: The journal ──────────────────────────────
                                     Everything else scrolls below — the detail layer.
                                ─────────────────────────────────────────────────────── */}
                                {logs.items && logs.items.length > 0 ? (
                                    <>
                                        <FoodLogList items={logs.items} onDelete={handleDelete} onEdit={handleEditClick} onMultiply={handleMultiply} />
                                        {/* Clear day — subtle, bottom of log, not intrusive */}
                                        <div className="text-center pt-2">
                                            <button
                                                onClick={() => { haptic.light(); updateLog({ items: [], water: 0 }); }}
                                                className="text-xs text-stone-300 dark:text-stone-600 hover:text-red-400 dark:hover:text-red-500 transition-colors"
                                            >
                                                Clear {selectedDate === getTodayStr() ? "today's" : "this day's"} log
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <EmptyState 
                                        onAddClick={handleQuickAdd}
                                        suggestions={FOOD_LIBRARY.filter(f => f.protein >= 15).slice(0, 3)}
                                        onGoLearn={() => setView('learn')}
                                    />
                                )}
                            </div>
                        )}
                        {view === 'settings' && (
                            <SettingsView 
                                profile={profile} 
                                onUpdate={(p) => { setProfile(p); DB.saveProfile(p); }} 
                                onLogout={DB.clearAll} 
                                toggleTheme={() => setIsDark(!isDark)} 
                                isDark={isDark} 
                                onNavigate={setView} 
                                selectedDate={selectedDate}
                                recentFoods={recentFoods}
                                onFoodsChanged={(updated) => setRecentFoods(updated)}
                            />
                        )}
                        {view === 'weekly' && <WeeklyView userId="local" />}
                        {view === 'learn' && <CheatSheet proteinRemaining={proteinRemaining} caloriesRemaining={caloriesRemaining} onLogFood={handleAdd} />}
                        {view === 'support' && <SupportView onBack={() => setView('settings')} />}
                    </div>
                </main>

                {/* Bottom Navigation - Fixed */}
                <nav className="flex-none bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="flex justify-between items-center w-full max-w-xs mx-auto">
                        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors active:scale-90 ${view === 'dashboard' ? 'text-violet-700 dark:text-violet-300' : 'text-stone-400'}`}>
                            <LayoutDashboard size={24} />
                            <span className="text-[10px] font-bold">Daily</span>
                        </button>
                        <button onClick={() => setView('weekly')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors active:scale-90 ${view === 'weekly' ? 'text-violet-700 dark:text-violet-300' : 'text-stone-400'}`}>
                            <BarChart3 size={24} />
                            <span className="text-[10px] font-bold">Weekly</span>
                        </button>
                        <button onClick={() => setView('learn')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors active:scale-90 ${view === 'learn' ? 'text-violet-700 dark:text-violet-300' : 'text-stone-400'}`}>
                            <BookOpen size={24} />
                            <span className="text-[10px] font-bold">Learn</span>
                        </button>
                    </div>
                </nav>
            </div>

            {/* Modals */}
            <AddFoodModal 
                isOpen={showAddModal} 
                onClose={() => { setShowAddModal(false); setEditingItem(null); }} 
                onAdd={handleAdd} 
                onSaveCustom={handleSaveCustom} 
                recentFoods={recentFoods} 
                initialData={editingItem?.item}
            />
            <WeightUpdateModal isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} currentWeight={profile.currentWeight} onUpdate={handleUpdateWeight} />
            {showInstallPrompt && (
                <InstallPrompt onDismiss={() => setShowInstallPrompt(false)} />
            )}
            
            {/* Toast */}
            {toast && (
                <Toast 
                    message={toast.message} 
                    action={toast.action}
                    onAction={handleUndo}
                    onClose={() => setToast(null)}
                    type={toast.type}
                />
            )}
        </div>
    );
};

// Mount the app
const root = createRoot(document.getElementById('root'));
root.render(<Steady />);

// Tell index.html the app has mounted — dismisses the loading screen
if (typeof window.__steadyReady === 'function') {
    setTimeout(window.__steadyReady, 150);
}
