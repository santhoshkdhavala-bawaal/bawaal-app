/// Locked 7-category BAWAAL sports master list for registration.
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
    'Archery',
    'Esports',
    'Yoga',
    'Dance Sport',
    'Other',
  ],
};

/// Flat dropdown entries: disabled category headers + selectable sports.
List<({String value, String label, bool isHeader})> get sportsDropdownEntries {
  final out = <({String value, String label, bool isHeader})>[];
  for (final entry in sportsCategories.entries) {
    out.add((
      value: 'header:${entry.key}',
      label: '-- ${entry.key} --',
      isHeader: true,
    ));
    for (final sport in entry.value) {
      out.add((value: sport, label: sport, isHeader: false));
    }
  }
  return out;
}

bool isSportsHeaderValue(String? value) =>
    value == null || value.startsWith('header:');
