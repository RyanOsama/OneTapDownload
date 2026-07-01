class ExtractResult {
  final String title;
  final String author;
  final String duration;
  final String thumbnail;
  final String platform;
  final String platformName;
  final List<DownloadOption> downloads;

  ExtractResult({
    required this.title,
    required this.author,
    required this.duration,
    required this.thumbnail,
    required this.platform,
    required this.platformName,
    required this.downloads,
  });

  factory ExtractResult.fromJson(Map<String, dynamic> json) {
    return ExtractResult(
      title: json['title'] ?? '',
      author: json['author'] ?? '',
      duration: json['duration'] ?? '',
      thumbnail: json['thumbnail'] ?? '',
      platform: json['platform'] ?? '',
      platformName: json['platformName'] ?? '',
      downloads: (json['downloads'] as List? ?? [])
          .map((dl) => DownloadOption.fromJson(dl))
          .toList(),
    );
  }
}

class DownloadOption {
  final String url;
  final String quality;
  final String size;
  final String type;
  final String labelAr;
  final String labelEn;

  DownloadOption({
    required this.url,
    required this.quality,
    required this.size,
    required this.type,
    required this.labelAr,
    required this.labelEn,
  });

  factory DownloadOption.fromJson(Map<String, dynamic> json) {
    return DownloadOption(
      url: json['url'] ?? '',
      quality: json['quality'] ?? '',
      size: json['size'] ?? '',
      type: json['type'] ?? '',
      labelAr: json['labelAr'] ?? '',
      labelEn: json['labelEn'] ?? '',
    );
  }
}
