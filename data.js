// Fixed 5-day workout plan, transcribed from the user's Trainerize program.
// Each exercise: { name, sets, reps, unit: 'lbs'|'bodyweight', perSide: bool }

const CARDIO_WARMUP_NOTE = '7–10 min on the StairMaster, spin bike, or incline treadmill walk (8% incline)';

const UPPER_BODY_WARMUP_STRETCHES = ['Forward arm circles — 2×10 each side', 'Backward arm circles — 2×10 each side'];
const LEG_WARMUP_STRETCHES = [
  'Single leg swings, front-to-back — 10 each leg',
  'Single leg swings, side-to-side — 10 each leg',
  'Bird dog — 10 each side, hold 3 sec',
  'Walking lunges — 10 each leg',
  'Body weight squats — 2×10',
];

// ~5 min of static stretching targeting the muscles just trained, held ~20-30 sec each.
const BACK_BICEPS_COOLDOWN = {
  target: 'lats, mid-back, biceps',
  stretches: [
    "Child's pose — 30 sec",
    'Cat-cow — 8 slow reps',
    'Cross-body bicep stretch — 20 sec each arm',
    'Standing forward fold — 30 sec',
    'Seated spinal twist — 20 sec each side',
  ],
};
const LEGS_COOLDOWN = {
  target: 'quads, hamstrings, calves, glutes',
  stretches: [
    'Standing quad stretch — 20 sec each leg',
    'Seated forward fold (hamstrings) — 30 sec',
    'Wall calf stretch — 20 sec each leg',
    'Figure-4 glute stretch — 20 sec each leg',
    'Butterfly stretch (inner thigh) — 30 sec',
  ],
};
const SHOULDERS_ABS_COOLDOWN = {
  target: 'shoulders, delts, abs/core',
  stretches: [
    'Cross-body shoulder stretch — 20 sec each arm',
    'Overhead triceps/shoulder stretch — 20 sec each arm',
    'Cobra stretch (abs) — 30 sec',
    "Child's pose (shoulders) — 30 sec",
    'Seated spinal twist (obliques) — 20 sec each side',
  ],
};
const CHEST_TRICEPS_COOLDOWN = {
  target: 'chest, triceps, shoulders',
  stretches: [
    'Doorway chest stretch — 30 sec',
    'Overhead triceps stretch — 20 sec each arm',
    'Cross-body shoulder stretch — 20 sec each arm',
    'Cat-cow — 8 slow reps',
    "Child's pose — 30 sec",
  ],
};

const CARDIO_META = { id: 'cardio', name: 'Cardio', icon: '🍁', color: '#a0653a' };
const CARDIO_ACTIVITIES = ['Incline Treadmill Walk', 'StairMaster', 'Spin Bike', 'Elliptical', 'Swimming', 'Outdoor Run/Walk', 'Other'];

const CLASS_META = { id: 'class', name: 'Class', icon: '🧘', color: '#6b4570' };
const CLASS_TYPES = ['Lagree', 'Spin', 'Pilates', 'Yoga', 'Hot Yoga', 'Hot Pilates', 'Other'];

// Config driving the two "simple" activity types (not the fixed 5-day lifting
// plan): a single activity/type pick + duration + optional notes each.
const ACTIVITY_TYPES = {
  cardio: { meta: CARDIO_META, options: CARDIO_ACTIVITIES, optionLabel: 'Activity', saveLabel: 'Save Cardio' },
  class: { meta: CLASS_META, options: CLASS_TYPES, optionLabel: 'Class type', saveLabel: 'Save Class' },
};

// Every user-created custom day gets this same warm-up/cool-down automatically
// (not authored per custom day) so the log form stays consistent without
// making the "create a day" form ask for stretch routines too.
const GENERIC_WARMUP = {
  cardio: CARDIO_WARMUP_NOTE,
  stretches: ['Arm circles — 2×10 each direction', 'Leg swings — 10 each direction per leg', 'Body weight squats — 2×10'],
};
const GENERIC_COOLDOWN = {
  target: 'whatever you trained',
  stretches: [
    "Child's pose — 30 sec",
    'Standing forward fold — 30 sec',
    'Cross-body shoulder stretch — 20 sec each arm',
    'Standing quad stretch — 20 sec each leg',
  ],
};

// Quick-pick options for the custom day creator. Icons are drawn from the same
// fall reference set used elsewhere, skipping ones already assigned to a
// built-in day/activity. Colors stay in the same warm/muted family as the
// built-in day colors but are new hues so custom days stay visually distinct.
const CUSTOM_DAY_ICON_PRESETS = ['🍷', '🥾', '🌰', '🥧', '🍯', '🧺', '🧸', '🍪', '🦔', '🪵'];
const CUSTOM_DAY_COLOR_PRESETS = ['#3d5a6c', '#a85a6b', '#4a6741', '#7a4a2b', '#8a6d3f', '#5c4a6b'];

const WORKOUT_PLAN = [
  {
    id: 'back-biceps',
    name: 'Back / Biceps',
    icon: '🧣',
    color: '#8c3a4a',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: BACK_BICEPS_COOLDOWN,
    exercises: [
      { name: 'Lat Machine Wide Grip Pulldown', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Cable Seated Row', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Standing Row', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Bicep Curl', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Single Arm Bent Over Row', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Incline Rear Row', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Incline Bicep Curl', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Hyperextension Roman Chair', sets: 3, reps: 10, unit: 'bodyweight' },
      { name: 'Superman', sets: 3, reps: 10, unit: 'bodyweight' },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    icon: '🎃',
    color: '#6b7d4f',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: LEG_WARMUP_STRETCHES },
    cooldown: LEGS_COOLDOWN,
    exercises: [
      { name: 'Dumbbell Squat', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Reverse Lunge', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Step Up', sets: 3, reps: 8, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Split Squat', sets: 3, reps: 8, unit: 'lbs', perSide: true },
      { name: 'Side Lunge', sets: 3, reps: 10, unit: 'bodyweight', perSide: true },
      { name: 'Dumbbell Glute Bridge Floor', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Fire Hydrant', sets: 3, reps: 10, unit: 'bodyweight', perSide: true },
      { name: 'Machine Leg Press', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Leg Press Machine Calf Raise', sets: 3, reps: 10, unit: 'lbs' },
    ],
  },
  {
    id: 'shoulders-abs',
    name: 'Shoulders / Abs',
    icon: '☕',
    color: '#d2691e',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: SHOULDERS_ABS_COOLDOWN,
    exercises: [
      { name: 'Dumbbell Seated Shoulder Press', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Single Arm Lateral Raise', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Front Raise', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell 90 Degree Lateral Raise', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Upright Row', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Machine Seated Shoulder Press', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Side Bend', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Toe Touch', sets: 3, reps: 10, unit: 'bodyweight' },
      { name: 'V Up', sets: 3, reps: 10, unit: 'bodyweight' },
    ],
  },
  {
    id: 'chest-triceps',
    name: 'Chest / Triceps',
    icon: '🧶',
    color: '#b5482f',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: CHEST_TRICEPS_COOLDOWN,
    exercises: [
      { name: 'Dumbbell Bench Press', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Bench Dip', sets: 3, reps: 10, unit: 'bodyweight' },
      { name: 'Dumbbell Pullover', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Tricep Kickback', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Incline Bench Chest Press', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Cable Straight Bar Tricep Pushdown', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Cable Single Arm Standing Fly', sets: 3, reps: 10, unit: 'lbs', perSide: true },
      { name: 'Machine Seated Chest Fly', sets: 3, reps: 10, unit: 'lbs' },
    ],
  },
  {
    id: 'legs-optional',
    name: 'Legs (Optional)',
    icon: '🍂',
    color: '#c48a1f',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: LEG_WARMUP_STRETCHES },
    cooldown: LEGS_COOLDOWN,
    exercises: [
      { name: 'Dumbbell Front Squat', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Deadlift', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Dumbbell Forward Lunge', sets: 3, reps: 8, unit: 'lbs', perSide: true },
      { name: 'Box Pistol Squat', sets: 3, reps: 8, unit: 'bodyweight', perSide: true },
      { name: 'Dumbbell Walking Lunge', sets: 3, reps: 8, unit: 'lbs', perSide: true },
      { name: 'Dumbbell Calf Raise', sets: 3, reps: 10, unit: 'lbs' },
      { name: 'Straight Leg Kickback', sets: 3, reps: 10, unit: 'bodyweight', perSide: true },
      { name: 'Single Leg Glute Bridge', sets: 3, reps: 10, unit: 'bodyweight', perSide: true },
    ],
  },
];
