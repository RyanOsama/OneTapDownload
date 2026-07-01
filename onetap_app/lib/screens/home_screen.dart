import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/download_service.dart';
import '../models/extract_result.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _urlController = TextEditingController();
  bool _isLoading = false;
  List<ExtractResult> _results = [];
  String _errorMessage = '';

  Future<void> _analyzeUrl() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _results = [];
    });

    try {
      final results = await ApiService.extractUrl(url);
      setState(() {
        _results = results;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OneTapDownload', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: RefreshIndicator(
        color: const Color(0xFF8b5cf6),
        onRefresh: () async {
          setState(() {
            _urlController.clear();
            _results.clear();
            _errorMessage = '';
          });
          await Future.delayed(const Duration(milliseconds: 500));
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _urlController,
                decoration: InputDecoration(
                  hintText: 'ضع الرابط هنا...',
                  filled: true,
                  fillColor: const Color(0xFF1a1c29),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  prefixIcon: const Icon(Icons.link),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      _urlController.clear();
                      setState(() {
                        _results.clear();
                        _errorMessage = '';
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _analyzeUrl,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8b5cf6),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white))
                      : const Text('تحليل الرابط', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
              if (_errorMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withAlpha(25),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red),
                      const SizedBox(width: 12),
                      Expanded(child: Text(_errorMessage, style: const TextStyle(color: Colors.red))),
                    ],
                  ),
                ),
              if (_results.isNotEmpty)
                ..._results.map((item) => _buildResultCard(item)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultCard(ExtractResult item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: const Color(0xFF1a1c29),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    item.thumbnail,
                    width: 100,
                    height: 100,
                    fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => Container(
                      width: 100, height: 100, color: Colors.grey[800],
                      child: const Icon(Icons.image_not_supported),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.platformName, style: const TextStyle(color: Color(0xFF8b5cf6), fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                )
              ],
            ),
            const SizedBox(height: 16),
            const Text('خيارات التحميل', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...item.downloads.map((dl) => _buildDownloadRow(item, dl)),
          ],
        ),
      ),
    );
  }

  Widget _buildDownloadRow(ExtractResult item, DownloadOption dl) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(dl.type == 'video' ? Icons.video_file : Icons.audio_file, color: Colors.grey, size: 20),
              const SizedBox(width: 8),
              Text('${dl.quality} (${dl.size})', style: const TextStyle(fontSize: 14)),
            ],
          ),
          ElevatedButton.icon(
            onPressed: () {
              final cleanTitle = item.title.replaceAll(RegExp(r'[^a-zA-Z0-9أ-ي]'), '_');
              final filename = '${cleanTitle}_${dl.quality}.${dl.type == 'video' ? 'mp4' : 'mp3'}';
              Provider.of<DownloadService>(context, listen: false).startDownload(
                url: dl.url,
                fileName: filename,
                title: item.title,
                thumbnail: item.thumbnail,
              );
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('بدأ التحميل... تابع شاشة العمليات')));
            },
            icon: const Icon(Icons.download, size: 18),
            label: const Text('تحميل'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFd946ef),
              foregroundColor: Colors.white,
              visualDensity: VisualDensity.compact,
            ),
          )
        ],
      ),
    );
  }
}
