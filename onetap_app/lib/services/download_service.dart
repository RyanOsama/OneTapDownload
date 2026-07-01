import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class DownloadTask {
  final String id;
  final String url;
  final String fileName;
  final String title;
  final String thumbnail;
  double progress;
  String status; // 'downloading', 'completed', 'error'
  String localPath;
  CancelToken? cancelToken;

  DownloadTask({
    required this.id,
    required this.url,
    required this.fileName,
    required this.title,
    required this.thumbnail,
    this.progress = 0.0,
    this.status = 'downloading',
    this.localPath = '',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'url': url,
        'fileName': fileName,
        'title': title,
        'thumbnail': thumbnail,
        'status': status,
        'localPath': localPath,
      };

  factory DownloadTask.fromJson(Map<String, dynamic> json) {
    return DownloadTask(
      id: json['id'],
      url: json['url'],
      fileName: json['fileName'],
      title: json['title'],
      thumbnail: json['thumbnail'],
      progress: 1.0, // History items are completed
      status: json['status'],
      localPath: json['localPath'] ?? '',
    );
  }
}

class DownloadService extends ChangeNotifier {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(minutes: 5),
    receiveTimeout: const Duration(hours: 2), // Allow very long videos
  ));
  
  final List<DownloadTask> _activeDownloads = [];
  List<DownloadTask> _history = [];

  List<DownloadTask> get activeDownloads => _activeDownloads;
  List<DownloadTask> get history => _history;

  DownloadService() {
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final String? historyStr = prefs.getString('download_history');
    if (historyStr != null) {
      final List<dynamic> decoded = jsonDecode(historyStr);
      _history = decoded.map((e) => DownloadTask.fromJson(e)).toList();
      notifyListeners();
    }
  }

  Future<void> _saveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final String encoded = jsonEncode(_history.map((e) => e.toJson()).toList());
    await prefs.setString('download_history', encoded);
  }

  Future<void> startDownload({
    required String url,
    required String fileName,
    required String title,
    required String thumbnail,
  }) async {
    // Request storage permission
    if (Platform.isAndroid) {
      // On Android 13+ (API 33), storage permission is deprecated for media, we request videos
      var status = await Permission.videos.status;
      if (!status.isGranted) {
        status = await Permission.videos.request();
      }
      var storageStatus = await Permission.storage.status;
      if (!storageStatus.isGranted) {
        storageStatus = await Permission.storage.request();
      }
      
      // We proceed even if denied because Android 10+ can write to Downloads without explicit permissions via Scoped Storage
    }

    // Use public Downloads directory on Android so user can see the file
    Directory? dir;
    if (Platform.isAndroid) {
      dir = Directory('/storage/emulated/0/Download');
      if (!await dir.exists()) {
        dir = await getExternalStorageDirectory();
      }
    } else {
      dir = await getApplicationDocumentsDirectory();
    }
    
    final savePath = '${dir!.path}/$fileName';

    final task = DownloadTask(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      url: url,
      fileName: fileName,
      title: title,
      thumbnail: thumbnail,
    );

    _activeDownloads.add(task);
    notifyListeners();

    task.cancelToken = CancelToken();

    try {
      await _dio.download(
        url,
        savePath,
        cancelToken: task.cancelToken,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            task.progress = received / total;
          } else {
            task.progress = -1.0; // Indeterminate state
          }
          notifyListeners();
        },
      );
      
      task.status = 'completed';
      task.localPath = savePath;
      task.progress = 1.0;
      
      // Move to history
      _activeDownloads.remove(task);
      _history.insert(0, task);
      await _saveHistory();
      notifyListeners();
      
    } catch (e) {
      if (e is DioException && CancelToken.isCancel(e)) {
        // User cancelled, do nothing except remove
      } else {
        task.status = 'failed';
      }
      _activeDownloads.remove(task);
      notifyListeners();
    }
  }

  void cancelDownload(String id) {
    final task = _activeDownloads.firstWhere((t) => t.id == id, orElse: () => DownloadTask(id: '', url: '', fileName: '', title: '', thumbnail: ''));
    if (task.id.isNotEmpty && task.cancelToken != null) {
      task.cancelToken!.cancel();
      _activeDownloads.remove(task);
      notifyListeners();
    }
  }

  Future<void> clearHistory() async {
    _history.clear();
    _saveHistory();
    notifyListeners();
  }
}
