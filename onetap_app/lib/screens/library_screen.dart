import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/download_service.dart';
import 'video_player_screen.dart';

class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final downloadService = Provider.of<DownloadService>(context);
    final history = downloadService.history;

    return Scaffold(
      appBar: AppBar(
        title: const Text('مكتبتي', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () {
              downloadService.clearHistory();
            },
          )
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF8b5cf6),
        onRefresh: () async {
          await Future.delayed(const Duration(milliseconds: 500));
        },
        child: history.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.35),
                  const Center(child: Text('المكتبة فارغة', style: TextStyle(color: Colors.grey))),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: history.length,
                itemBuilder: (context, index) {
                final task = history[index];
                return Card(
                  color: const Color(0xFF1a1c29),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(8),
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        task.thumbnail,
                        width: 60,
                        height: 60,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const Icon(Icons.image),
                      ),
                    ),
                    title: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                    subtitle: Text('تم التحميل بنجاح ✓\n(تم الحفظ في مجلد التنزيلات Downloads)', style: TextStyle(color: Colors.green[400], fontSize: 11)),
                    isThreeLine: true,
                    onTap: () {
                      if (task.localPath.endsWith('.mp4') || task.localPath.endsWith('.webm')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => VideoPlayerScreen(
                              videoPath: task.localPath,
                              title: task.title,
                            ),
                          ),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('لا يمكن تشغيل هذا النوع من الملفات داخل التطبيق. تجده في التنزيلات.')),
                        );
                      }
                    },
                  ),
                );
              },
            ),
      ),
    );
  }
}
