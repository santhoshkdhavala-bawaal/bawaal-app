/// Grouped sports taxonomy for the registration Sports picker.
const Map<String, List<String>> sportsCategories = {
  'Ball Sports': [
    'Cricket',
    'Football',
    'Kabaddi',
    'Basketball',
    'Tennis',
    'Badminton',
    'Volleyball',
    'Hockey',
  ],
  'Combat Sports': [
    'Boxing',
    'MMA',
    'Wrestling',
    'Kickboxing',
    'Judo',
    'Karate',
    'Taekwondo',
    'Muay Thai',
  ],
  'Racing & Speed': [
    'Motorsport',
    'Bike Racing',
    'Karting',
    'Sprint',
    'Track Cycling',
  ],
  'Water & Surf': [
    'Surfing',
    'Swimming',
    'Rowing',
    'Kayaking',
    'Water Polo',
    'Diving',
  ],
  'Extreme & Adventure': [
    'Skateboarding',
    'Climbing',
    'Parkour',
    'Skydiving',
    'BMX',
    'Trail Running',
  ],
  'Strength & Fitness': [
    'Gym',
    'Powerlifting',
    'CrossFit',
    'Calisthenics',
    'Olympic Weightlifting',
    'Bodybuilding',
  ],
  'Others': [
    'Esports',
    'Yoga',
    'Dance Sport',
    'Other',
  ],
};

List<String> get allSportsFlat {
  final out = <String>[];
  for (final entry in sportsCategories.entries) {
    out.addAll(entry.value);
  }
  return out;
}
