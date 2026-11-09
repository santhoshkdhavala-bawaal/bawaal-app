class RegistrationData {
  const RegistrationData({
    required this.userName,
    required this.realName,
    required this.age,
    required this.gender,
    required this.email,
    required this.phone,
    required this.location,
    required this.sport,
    required this.role,
  });

  final String userName;
  final String realName;
  final int age;
  final String gender;
  final String email;
  final String phone;
  final String location;
  final String sport;
  final String role;

  String get handle {
    final cleaned = userName.trim().replaceFirst(RegExp(r'^@+'), '');
    return cleaned.isEmpty ? '@athlete' : '@$cleaned';
  }

  Map<String, dynamic> toProfileRow(String userId) {
    return {
      'id': userId,
      'real_name': realName.trim(),
      'gender': gender,
      'age': age,
      'mobile': phone.trim(),
      'location': location.trim(),
      'role': role.toLowerCase(),
      'sport_interests': [sport],
      'display_name': userName.trim(),
      'handle': handle,
      'sport': sport,
      'city': location.trim(),
      'full_name': realName.trim(),
      'primary_sport': sport,
      'list_bucket': 'self',
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    };
  }

  Map<String, dynamic> toSlimProfileRow(String userId) {
    return {
      'id': userId,
      'real_name': realName.trim(),
      'gender': gender,
      'age': age,
      'mobile': phone.trim(),
      'location': location.trim(),
      'role': role.toLowerCase(),
      'sport_interests': [sport],
    };
  }
}
