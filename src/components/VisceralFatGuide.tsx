import React, { useState } from 'react';
import { Shield, Dumbbell, Heart, Activity, Apple, ChevronDown, ChevronUp } from 'lucide-react';

export default function VisceralFatGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [openWorkout, setOpenWorkout] = useState('A');

  return (
    // Wraps cleanly inside your existing layout background
    <div className="steady-app-shell font-sans text-slate-800 selection:bg-purple-200 antialiased">
      <main className="max-w-4xl mx-auto px-4 py-8 animate-fade-in smooth-scroll">
        
        {/* Header Block matching your clean, light theme */}
        <header className="mb-8 text-center sm:text-left border-b border-gray-200/60 pb-6">
          <span className="text-xs font-bold tracking-wider uppercase bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
            Steady Resource Guide
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-3 text-slate-900">
            The Steady Guide to Visceral Fat [cite: 1]
          </h1>
          <p className="text-base text-slate-600 mt-2 max-w-2xl">
            A simple, budget-friendly plan for reducing visceral fat, building muscle, lowering inflammation, and eating in a way you can actually keep doing. [cite: 2]
          </p>
        </header>

        {/* Core Philosophy Banner using custom card variables */}
        <div className="steady-card rounded-2xl p-6 mb-8 shadow-sm border-l-4 border-l-purple-500">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">The Core Idea [cite: 3]</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Eat enough protein. Eat more fiber and colorful plants. Lift 3 days per week. Do cardio 2-4 days per week. [cite: 4] 
            Reduce sugary drinks and ultra-processed foods. <strong className="text-purple-700 font-bold">Track your waist, not just the scale.</strong> [cite: 5]
          </p>
        </div>

        {/* Navigation Tabs utilizing your theme variables */}
        <div className="flex gap-1 mb-6 bg-slate-200/50 p-1 rounded-xl scrollbar-hide overflow-x-auto">
          {[
            { id: 'overview', label: 'Basics & Levers', icon: Activity },
            { id: 'nutrition', label: 'Nutrition & Plates', icon: Apple },
            { id: 'fitness', label: 'Workout Blueprint', icon: Dumbbell },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'steady-primary-btn shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & Levers */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            <section className="grid md:grid-cols-2 gap-4">
              <div className="steady-card rounded-xl p-5">
                <h3 className="text-base font-bold text-slate-900 mb-2">What Visceral Fat Is [cite: 19]</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Visceral fat is deep abdominal fat stored around internal organs, separate from the softer subcutaneous fat under the skin. [cite: 20, 21] 
                  While you can't spot-reduce it, it responds beautifully to sustained overall fat loss, aerobic activity, and protein. [cite: 22]
                </p>
              </div>
              <div className="steady-card rounded-xl p-5">
                <h3 className="text-base font-bold text-slate-900 mb-2">Why Track the Waist? [cite: 13]</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Visceral fat is metabolically active and releases inflammatory markers. [cite: 25] Because weight bounces around due to muscle retention and hydration, a shrinking waist trend is your best practical utility tracking tool. [cite: 12, 13, 26, 27]
                </p>
              </div>
            </section>

            {/* Matrix of Levers */}
            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-3">The 5 Biggest Levers [cite: 30]</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { title: 'Calorie Deficit', action: 'Eat slightly less than you burn.', why: 'Main driver of visceral fat reduction.' },
                  { title: 'Lean Protein', action: 'Build meals around lean sources.', why: 'Supports fullness and protects muscle.' },
                  { title: 'Fiber & Plants', action: 'Add oats, beans, and berries.', why: 'Improves gut health & blood sugar.' },
                  { title: 'Cardio Engine', action: '2-4 moderate sessions weekly.', why: 'Improves insulin sensitivity.' },
                  { title: 'Strength Base', action: '3 full-body days per week.', why: 'Drives true body recomposition.' },
                ].map((lever, idx) => (
                  <div key={idx} className="steady-card rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-teal-600 block mb-1">LEVER 0{idx + 1}</span>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{lever.title}</h4>
                      <p className="text-xs text-slate-600 mb-3">{lever.action}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 border-t border-gray-100 pt-2">{lever.why}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Nutrition & Plates */}
        {activeTab === 'nutrition' && (
          <div className="space-y-6 animate-slide-up">
            <section className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 steady-card rounded-xl p-5">
                <h3 className="text-base font-bold text-slate-900 mb-3">The Plate Formula [cite: 40]</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-50/60 p-3 rounded-lg border border-purple-100"><span className="text-purple-700 font-bold text-xs">¼ Protein:</span> <p className="text-[11px] text-slate-600 mt-0.5">Chicken, turkey, lean beef, Greek yogurt</p></div>
                  <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-100"><span className="text-teal-700 font-bold text-xs">¼ Fiber Carb:</span> <p className="text-[11px] text-slate-600 mt-0.5">Brown rice, oats, black beans, sweet potato</p></div>
                  <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100 col-span-2"><span className="text-amber-800 font-bold text-xs">½ Color:</span> <p className="text-[11px] text-slate-600 mt-0.5">Broccoli, spinach, peppers, fresh or warm salsa, frozen berries</p></div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 text-center italic">"Repetition is how results get quietly annoying in a good way." [cite: 42]</p>
              </div>

              <div className="steady-card rounded-xl p-5 bg-gradient-to-b from-white to-slate-50 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Budget Superpower [cite: 36]</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Frozen produce is a budget superpower wearing sweatpants. [cite: 36] Blend 4-5 oz of meat with ½ cup of beans to optimize protein, volume, and meal cost. [cite: 38, 39]
                  </p>
                </div>
                <div className="text-[11px] font-bold text-purple-700 mt-3 bg-purple-50 py-1.5 px-2 rounded text-center border border-purple-100">
                  Target: ~150-180g Protein Daily [cite: 13]
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-bold text-slate-900 mb-3">App-Friendly Default Options [cite: 46]</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { title: 'Turkey Taco Bowl [cite: 47]', build: 'Ground turkey, rice, black beans, peppers, onions, salsa, Greek yogurt.' [cite: 47] },
                  { title: 'Protein Oats [cite: 47]', build: 'Oats, Greek yogurt, frozen berries, cinnamon, flax seed.' [cite: 47] },
                  { title: 'Chicken Rice Broccoli Bowl [cite: 47]', build: 'Chicken breast, white or brown rice, steamed broccoli, hot sauce or salsa.' [cite: 47] },
                  { title: 'Turkey Chili Batch [cite: 47]', build: 'Ground turkey, mixed kidney/black beans, diced tomatoes, peppers, chili spices.' [cite: 47] },
                  { title: 'Tuna Bean Wrap [cite: 47]', build: 'Canned tuna, chickpeas or black beans, light Greek yogurt spread, cabbage, tortilla.' [cite: 47] }
                ].map((meal, idx) => (
                  <div key={idx} className="steady-card rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
                    <h4 className="font-bold text-slate-900 text-xs mb-1">{meal.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{meal.build}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 3: Fitness & Accordions */}
        {activeTab === 'fitness' && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
              <Heart className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-teal-900">Zone 2 Cardio Rule [cite: 62]</h4>
                <p className="text-[11px] text-teal-800 mt-0.5 leading-relaxed">
                  Keep movement at a pace where you're working but can comfortably converse in short sentences. [cite: 62] Protects the joints while hitting the heart engine. [cite: 60, 75]
                </p>
              </div>
            </div>

            <section className="space-y-2">
              {[
                {
                  id: 'A',
                  title: 'Strength Session A (Full Body Focus) [cite: 70]',
                  exercises: [
                    { name: 'Leg Press or Box Squat', sets: '3 x 8-10', note: 'Knee-friendly pattern' },
                    { name: 'Dumbbell Bench / Incline Push-up', sets: '3 x 8-12', note: 'Push pattern' },
                    { name: 'Seated Row Machine', sets: '3 x 10-12', note: 'Upper back structural' },
                    { name: 'Romanian Deadlift (RDL)', sets: '3 x 8-10', note: 'Hinge + hamstrings' },
                    { name: 'Dead Bug', sets: '2 x 10/side', note: 'Core stability' }
                  ]
                },
                {
                  id: 'B',
                  title: 'Strength Session B (Posterior & Core Focus) [cite: 70]',
                  exercises: [
                    { name: 'Kettlebell / Dumbbell Deadlift', sets: '3 x 6-8', note: 'Build strong hinge' },
                    { name: 'Lat Pulldown', sets: '3 x 10-12', note: 'Back + posture' },
                    { name: 'Step-ups or Glute Bridges', sets: '3 x 10', note: 'Swap as needed for knees' },
                    { name: 'Machine Chest Press', sets: '3 x 8-12', note: 'Stable pushing track' },
                    { name: 'Farmer Carry', sets: '3 x 30-45 sec', note: 'Grip + core structural' }
                  ]
                },
                {
                  id: 'C',
                  title: 'Strength Session C (Recomposition Base) [cite: 70]',
                  exercises: [
                    { name: 'Goblet Squat or Leg Press', sets: '3 x 10', note: 'Lower body base' },
                    { name: 'Single-Arm Dumbbell Row', sets: '3 x 10/side', note: 'Pull pattern track' },
                    { name: 'Incline Dumbbell Press', sets: '3 x 8-12', note: 'Chest and shoulders' },
                    { name: 'Hip Thrust or Glute Bridge', sets: '3 x 10-12', note: 'Glutes + posterior' },
                    { name: 'Pallof Press', sets: '2 x 10/side', note: 'Anti-rotation control' }
                  ]
                }
              ].map((workout) => {
                const isOpen = openWorkout === workout.id;
                return (
                  <div key={workout.id} className="steady-card rounded-xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpenWorkout(isOpen ? '' : workout.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-bold text-slate-900 text-xs md:text-sm">{workout.title}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    
                    {isOpen && (
                      <div className="px-4 pb-3 border-t border-gray-100 bg-white divide-y divide-gray-50 animate-zoom-in">
                        {workout.exercises.map((ex, i) => (
                          <div key={i} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                            <div className="font-bold text-slate-800">{ex.name}</div>
                            <div className="flex items-center gap-4 justify-between sm:justify-end text-slate-500">
                              <span className="text-purple-600 font-mono font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{ex.sets}</span>
                              <span className="sm:w-44 text-left sm:text-right text-slate-400">{ex.note}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* Local-First Mobile Optimization Footer */}
        <footer className="mt-8 pt-4 border-t border-gray-200/60 text-[10px] text-slate-400 space-y-3">
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-gray-100">
            <Shield className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              <strong>General Education Only:</strong> Not medical advice. [cite: 6] Individuals tracking with managed chronic systems (including thyroid synchronization via levothyroxine, which requires isolated empty stomach administration 30-60 minutes prior to morning food intake) should keep standard tracking clean and consult clinical professionals before starting complex training programs. [cite: 6, 80, 81, 86]
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
