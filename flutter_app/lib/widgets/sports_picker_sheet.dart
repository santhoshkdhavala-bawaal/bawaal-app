import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';
import '../data/sports_categories.dart';

Future<String?> showSportsPickerSheet(
  BuildContext context, {
  String? selected,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _SportsPickerSheet(selected: selected),
  );
}

class _SportsPickerSheet extends StatefulWidget {
  const _SportsPickerSheet({this.selected});

  final String? selected;

  @override
  State<_SportsPickerSheet> createState() => _SportsPickerSheetState();
}

class _SportsPickerSheetState extends State<_SportsPickerSheet> {
  final _query = TextEditingController();
  String _search = '';

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Map<String, List<String>> get _filtered {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return sportsCategories;

    final out = <String, List<String>>{};
    for (final entry in sportsCategories.entries) {
      final matches = entry.value
          .where((sport) => sport.toLowerCase().contains(q))
          .toList();
      final categoryHit = entry.key.toLowerCase().contains(q);
      if (categoryHit) {
        out[entry.key] = List<String>.from(entry.value);
      } else if (matches.isNotEmpty) {
        out[entry.key] = matches;
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final filtered = _filtered;

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.78,
        decoration: const BoxDecoration(
          color: BawaalColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'SELECT SPORT',
                      style: GoogleFonts.bebasNeue(
                        fontSize: 28,
                        letterSpacing: 1.2,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white70),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: TextField(
                controller: _query,
                onChanged: (v) => setState(() => _search = v),
                decoration: const InputDecoration(
                  hintText: 'Search sports…',
                  prefixIcon: Icon(Icons.search, color: BawaalColors.textMuted),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(
                      child: Text(
                        'No sports match that search.',
                        style: TextStyle(color: BawaalColors.textMuted),
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                      children: [
                        for (final entry in filtered.entries) ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(8, 14, 8, 6),
                            child: Text(
                              entry.key.toUpperCase(),
                              style: GoogleFonts.archivo(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.4,
                                color: BawaalColors.accent,
                              ),
                            ),
                          ),
                          ...entry.value.map((sport) {
                            final active = sport == widget.selected;
                            return ListTile(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              tileColor: active
                                  ? BawaalColors.accent.withValues(alpha: 0.14)
                                  : null,
                              title: Text(
                                sport,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight:
                                      active ? FontWeight.w700 : FontWeight.w500,
                                ),
                              ),
                              trailing: active
                                  ? const Icon(
                                      Icons.check_circle,
                                      color: BawaalColors.accent,
                                    )
                                  : null,
                              onTap: () => Navigator.pop(context, sport),
                            );
                          }),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
