import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/download_service.dart';

class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final downloadService = Provider.of<DownloadService>(context);
    final activeDownloads = downloadService.activeDownloads;

    return Scaffold(
      appBar: AppBar(
        title: const Text('عمليات التحميل', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: RefreshIndicator(
        color: const Color(0xFF8b5cf6),
        onRefresh: () async {
          await Future.delayed(const Duration(milliseconds: 500));
        },
        child: activeDownloads.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.35),
                  const Center(child: Text('لا توجد عمليات تحميل نشطة حالياً', style: TextStyle(color: Colors.grey))),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: activeDownloads.length,
                itemBuilder: (context, index) {
                final task = activeDownloads[index];
                return Card(
                  color: const Color(0xFF1a1c29),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                task.thumbnail,
                                width: 50,
                                height: 50,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const Icon(Icons.image),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(task.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 8),
                                  LinearProgressIndicator(
                                    value: task.progress < 0 ? null : task.progress,
                                    backgroundColor: Colors.grey[800],
                                    color: const Color(0xFF8b5cf6),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  task.progress < 0 ? 'جاري..' : '${(task.progress * 100).toStringAsFixed(0)}%',
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.cancel, color: Colors.grey, size: 20),
                                  onPressed: () {
                                    Provider.of<DownloadService>(context, listen: false).cancelDownload(task.id);
                                  },
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      ),
    );
  }
}
