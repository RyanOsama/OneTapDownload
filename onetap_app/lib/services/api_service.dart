import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/extract_result.dart';

import 'package:flutter/foundation.dart' show kIsWeb;

class ApiService {
  // Use localhost for Web testing, and your PC's IP for real phone testing.
  static const String baseUrl = kIsWeb ? 'http://localhost:3000' : 'http://192.168.1.164:3000'; 

  static Future<List<ExtractResult>> extractUrl(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/extract'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'url': url}),
      ).timeout(const Duration(seconds: 40));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['items'] != null) {
          return (data['items'] as List)
              .map((item) => ExtractResult.fromJson(item))
              .toList();
        }
        return [];
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['error'] ?? 'فشل التحميل من السيرفر');
      }
    } catch (e) {
      if (e.toString().contains('Exception:')) {
        throw Exception(e.toString().replaceAll('Exception: ', ''));
      }
      throw Exception('تعذر الاتصال بالسيرفر. تأكد من عمل السيرفر ومن أن الجوال والكمبيوتر على نفس شبكة الواي فاي.');
    }
  }
}
