// Fixed 5-day workout plan, transcribed from the user's Trainerize program.
// Each exercise: { name, sets, reps, unit: 'lbs'|'bodyweight', perSide: bool }

const CARDIO_WARMUP_NOTE = '7–10 min on the StairMaster, spin bike, or incline treadmill walk (8% incline)';
const COOLDOWN_NOTE = 'Spend at least 5 minutes stretching to help with recovery and injury prevention.';

const UPPER_BODY_WARMUP_STRETCHES = ['Forward arm circles — 2×10 each side', 'Backward arm circles — 2×10 each side'];
const LEG_WARMUP_STRETCHES = [
  'Single leg swings, front-to-back — 10 each leg',
  'Single leg swings, side-to-side — 10 each leg',
  'Bird dog — 10 each side, hold 3 sec',
  'Walking lunges — 10 each leg',
  'Body weight squats — 2×10',
];

const CARDIO_META = { id: 'cardio', name: 'Cardio', icon: '🏃', color: '#0ea5e9' };
const CARDIO_ACTIVITIES = ['Incline Treadmill Walk', 'StairMaster', 'Spin Bike', 'Elliptical', 'Outdoor Run/Walk', 'Other'];

const WORKOUT_PLAN = [
  {
    id: 'back-biceps',
    name: 'Back / Biceps',
    icon: '💪',
    color: '#6d63f0',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: COOLDOWN_NOTE,
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
    icon: '🦵',
    color: '#16a34a',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: LEG_WARMUP_STRETCHES },
    cooldown: COOLDOWN_NOTE,
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
    icon: '🎯',
    color: '#d97706',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: COOLDOWN_NOTE,
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
    icon: '🔥',
    color: '#e11d48',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: UPPER_BODY_WARMUP_STRETCHES },
    cooldown: COOLDOWN_NOTE,
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
    icon: '⭐',
    color: '#0891b2',
    warmup: { cardio: CARDIO_WARMUP_NOTE, stretches: LEG_WARMUP_STRETCHES },
    cooldown: COOLDOWN_NOTE,
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
